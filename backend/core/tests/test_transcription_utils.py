from types import SimpleNamespace

from django.test import SimpleTestCase
from pydub import AudioSegment
from pydub.generators import Sine

from core.views.base import (
    _build_transcription_variants,
    _infer_audio_upload_format,
    _infer_audio_upload_suffix,
    _trim_audio_to_speech_window,
)


class TranscriptionUploadInferenceTests(SimpleTestCase):
    def test_prefers_real_upload_suffix_from_filename(self):
        upload = SimpleNamespace(name="voice-note.m4a", content_type="audio/m4a")

        self.assertEqual(_infer_audio_upload_suffix(upload), ".m4a")
        self.assertEqual(_infer_audio_upload_format(upload, ".m4a"), "mp4")

    def test_uses_content_type_when_filename_has_no_extension(self):
        upload = SimpleNamespace(name="recording", content_type="audio/webm")

        self.assertEqual(_infer_audio_upload_suffix(upload), ".webm")
        self.assertEqual(_infer_audio_upload_format(upload, ".webm"), "webm")

    def test_maps_audio_mpeg_to_mp3_format(self):
        upload = SimpleNamespace(name="spoken-answer", content_type="audio/mpeg")

        self.assertEqual(_infer_audio_upload_suffix(upload), ".mp3")
        self.assertEqual(_infer_audio_upload_format(upload, ".mp3"), "mp3")

    def test_trim_audio_to_speech_window_removes_outer_silence(self):
        spoken = Sine(440).to_audio_segment(duration=900).apply_gain(-12)
        audio = AudioSegment.silent(duration=700) + spoken + AudioSegment.silent(duration=650)

        trimmed = _trim_audio_to_speech_window(audio)

        self.assertLess(len(trimmed), len(audio))
        self.assertGreaterEqual(len(trimmed), 900)

    def test_build_transcription_variants_returns_multiple_preprocessed_candidates(self):
        spoken = Sine(440).to_audio_segment(duration=1200).apply_gain(-22)
        audio = AudioSegment.silent(duration=500) + spoken + AudioSegment.silent(duration=400)

        variants = _build_transcription_variants(audio)

        self.assertGreaterEqual(len(variants), 3)
        self.assertTrue(all(len(variant) > 0 for variant in variants))
