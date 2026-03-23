from types import SimpleNamespace

from django.test import SimpleTestCase

from core.views.base import _infer_audio_upload_format, _infer_audio_upload_suffix


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
