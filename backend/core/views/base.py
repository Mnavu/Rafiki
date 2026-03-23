import os
import re
import difflib
import mimetypes
from pathlib import Path
from django.http import JsonResponse
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from pydub import AudioSegment
from pydub.effects import normalize as normalize_audio
import speech_recognition as sr
from tempfile import NamedTemporaryFile

SPEECH_PHRASE_REPLACEMENTS = {
    "time table": "timetable",
    "table time": "timetable",
    "class time table": "class timetable",
    "chat boat": "chatbot",
    "chat bot": "chatbot",
    "a sign ment": "assignment",
    "assigment": "assignment",
    "assainment": "assignment",
    "see a t": "cat",
    "cee a tee": "cat",
    "feez": "fees",
    "fee status": "fees status",
    "class group": "class community",
}

SPEECH_VOCABULARY = {
    "timetable",
    "class",
    "classes",
    "call",
    "calls",
    "assignment",
    "assignments",
    "cat",
    "exam",
    "course",
    "unit",
    "chatbot",
    "fees",
    "finance",
    "group",
    "community",
    "message",
    "messages",
    "lecturer",
    "student",
    "guardian",
    "schedule",
    "activity",
    "activities",
    "notice",
}

SPEECH_UPLOAD_FORMATS = {
    ".aac": "aac",
    ".aif": "aiff",
    ".aiff": "aiff",
    ".caf": "caf",
    ".flac": "flac",
    ".m4a": "mp4",
    ".mp3": "mp3",
    ".mp4": "mp4",
    ".oga": "ogg",
    ".ogg": "ogg",
    ".wav": "wav",
    ".webm": "webm",
}


def _normalize_speech_text(text: str) -> str:
    if not text:
        return ""
    normalized = text.lower().strip()

    for source, target in SPEECH_PHRASE_REPLACEMENTS.items():
        normalized = re.sub(rf"\b{re.escape(source)}\b", target, normalized)

    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return text.strip()

    corrected_tokens = []
    for token in normalized.split():
        if len(token) < 4 or token in SPEECH_VOCABULARY:
            corrected_tokens.append(token)
            continue
        best_match = difflib.get_close_matches(token, SPEECH_VOCABULARY, n=1, cutoff=0.82)
        corrected_tokens.append(best_match[0] if best_match else token)

    corrected = " ".join(corrected_tokens).strip()
    return corrected if corrected else text.strip()


def _extract_google_candidates(result):
    if isinstance(result, dict):
        alternatives = result.get("alternative") or []
        for alt in alternatives:
            transcript = (alt.get("transcript") or "").strip()
            if not transcript:
                continue
            confidence = alt.get("confidence")
            try:
                confidence_value = float(confidence) if confidence is not None else 0.0
            except (TypeError, ValueError):
                confidence_value = 0.0
            yield transcript, confidence_value


def _recognize_best_text(recognizer: sr.Recognizer, wav_paths: list[str]):
    best_text = ""
    best_confidence = 0.0
    best_score = -1.0

    for wav_path in wav_paths:
        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)

        # Primary pass with alternatives and confidence scores.
        try:
            detailed = recognizer.recognize_google(
                audio_data,
                language="en-KE",
                show_all=True,
            )
            for transcript, confidence in _extract_google_candidates(detailed):
                token_count = len(transcript.split())
                score = (confidence * 10.0) + min(token_count, 14) * 0.15
                if score > best_score:
                    best_score = score
                    best_text = transcript
                    best_confidence = confidence
        except sr.UnknownValueError:
            pass
        except sr.RequestError:
            pass

        # Fallback pass if alternatives were not returned.
        if not best_text:
            for language in ("en-KE", "en-US"):
                try:
                    fallback = recognizer.recognize_google(audio_data, language=language).strip()
                    if fallback:
                        score = min(len(fallback.split()), 14) * 0.15
                        if score > best_score:
                            best_score = score
                            best_text = fallback
                            best_confidence = 0.0
                        break
                except sr.UnknownValueError:
                    continue
                except sr.RequestError:
                    continue

    return best_text, best_confidence


def _infer_audio_upload_suffix(upload) -> str:
    upload_name = getattr(upload, "name", "") or ""
    suffix = Path(upload_name).suffix.lower()
    if suffix in SPEECH_UPLOAD_FORMATS:
        return suffix

    content_type = (getattr(upload, "content_type", "") or "").split(";")[0].strip().lower()
    if content_type in {"audio/m4a", "audio/x-m4a", "audio/mp4"}:
        return ".m4a"
    if content_type == "audio/mpeg":
        return ".mp3"
    if content_type == "audio/webm":
        return ".webm"
    if content_type == "audio/ogg":
        return ".ogg"
    if content_type in {"audio/wav", "audio/x-wav"}:
        return ".wav"
    guessed = mimetypes.guess_extension(content_type) or ""
    guessed = guessed.lower()
    if guessed in SPEECH_UPLOAD_FORMATS:
        return guessed
    return ".bin"


def _infer_audio_upload_format(upload, suffix: str) -> str | None:
    content_type = (getattr(upload, "content_type", "") or "").split(";")[0].strip().lower()
    if content_type in {"audio/m4a", "audio/x-m4a", "audio/mp4"}:
        return "mp4"
    if content_type == "audio/mpeg":
        return "mp3"
    return SPEECH_UPLOAD_FORMATS.get(suffix)


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return JsonResponse({"status": "ok"})

@api_view(["GET"])
@permission_classes([AllowAny])
def index(request):
    return JsonResponse({"name": "EduAssist", "docs": "/api/docs/", "health": "/api/core/health/"})

@api_view(["GET"])
@permission_classes([AllowAny])
def help_view(request):
    return JsonResponse(
        {
            "help": "Use the chatbot or menu to find courses, fees, and resources. You can also speak by pressing the microphone button.",
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def about_view(request):
    return JsonResponse(
        {
            "name": "EduAssist",
            "mission": "Accessible learning support for all students.",
            "values": ["Accessibility", "Simplicity", "Privacy", "Support"],
        }
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def transcribe_audio(request):
    upload = request.FILES.get("audio")
    if not upload:
        return Response({"detail": "audio file is required."}, status=status.HTTP_400_BAD_REQUEST)

    upload_suffix = _infer_audio_upload_suffix(upload)
    upload_format = _infer_audio_upload_format(upload, upload_suffix)

    # Save uploaded audio temporarily
    with NamedTemporaryFile(suffix=upload_suffix, delete=False) as temp_audio:
        for chunk in upload.chunks():
            temp_audio.write(chunk)
        temp_audio_path = temp_audio.name

    wav_paths = []
    try:
        audio = (
            AudioSegment.from_file(temp_audio_path, format=upload_format)
            if upload_format
            else AudioSegment.from_file(temp_audio_path)
        )
        prepared = normalize_audio(audio).set_channels(1).set_frame_rate(16000)

        # Run recognition against a few speed variants to improve hit-rate on unclear/slurred speech.
        variants = [
            prepared,
            prepared._spawn(
                prepared.raw_data,
                overrides={"frame_rate": int(prepared.frame_rate * 0.92)},
            ).set_frame_rate(16000),
            prepared._spawn(
                prepared.raw_data,
                overrides={"frame_rate": int(prepared.frame_rate * 1.08)},
            ).set_frame_rate(16000),
        ]

        for idx, variant in enumerate(variants):
            variant_path = f"{temp_audio_path}.{idx}.wav"
            variant.export(variant_path, format="wav")
            wav_paths.append(variant_path)

        recognizer = sr.Recognizer()
        recognizer.dynamic_energy_threshold = True
        recognizer.energy_threshold = 250

        raw_text, confidence = _recognize_best_text(recognizer, wav_paths)
        if not raw_text:
            raise ValueError("No recognizable speech detected.")

        normalized_text = _normalize_speech_text(raw_text)
        return Response(
            {
                "text": normalized_text,
                "raw_text": raw_text,
                "confidence": confidence,
            }
        )

    except Exception as e:
        return Response(
            {
                "detail": (
                    f"Failed to transcribe audio: {str(e)}. "
                    f"Received {upload_suffix or 'unknown'} input."
                )
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    finally:
        # Cleanup temp files
        try:
            os.unlink(temp_audio_path)
            for wav_path in wav_paths:
                if os.path.exists(wav_path):
                    os.unlink(wav_path)
        except Exception:
            pass
