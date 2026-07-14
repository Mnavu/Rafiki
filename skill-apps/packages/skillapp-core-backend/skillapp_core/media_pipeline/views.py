"""Stateless upload -> process -> return-result endpoint, mirroring Nanu's
core.views.base.transcribe_audio shape: accepts an audio file, runs it through
pydub (normalize) + SpeechRecognition, returns text and never persists
anything itself — the caller (e.g. a MilestoneSubmission or a voice-note
capture screen) decides what to do with the result.
"""
import os
import tempfile

from rest_framework import permissions
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView


class TranscribeAudioView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        audio_file = request.FILES.get("audio")
        if not audio_file:
            return Response({"detail": "No audio file provided."}, status=400)

        try:
            from pydub import AudioSegment
            import speech_recognition as sr
        except ImportError:
            return Response(
                {"detail": "Transcription dependencies (pydub, SpeechRecognition) are not installed."},
                status=503,
            )

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_in, tempfile.NamedTemporaryFile(
            suffix=".wav", delete=False
        ) as tmp_out:
            try:
                for chunk in audio_file.chunks():
                    tmp_in.write(chunk)
                tmp_in.flush()

                audio = AudioSegment.from_file(tmp_in.name)
                audio = audio.normalize() if hasattr(audio, "normalize") else audio
                audio.export(tmp_out.name, format="wav")

                recognizer = sr.Recognizer()
                with sr.AudioFile(tmp_out.name) as source:
                    audio_data = recognizer.record(source)
                text = recognizer.recognize_google(audio_data)
                return Response({"text": text, "confidence": 1.0})
            except sr.UnknownValueError:
                return Response({"text": "", "confidence": 0.0, "detail": "Could not understand audio."})
            except Exception as exc:  # noqa: BLE001 - surfaced to the caller, not swallowed silently
                return Response({"detail": f"Transcription failed: {exc}"}, status=422)
            finally:
                for path in (tmp_in.name, tmp_out.name):
                    if os.path.exists(path):
                        os.remove(path)
