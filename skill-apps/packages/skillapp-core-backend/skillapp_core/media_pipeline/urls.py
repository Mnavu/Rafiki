from django.urls import path

from .views import TranscribeAudioView

app_name = "media_pipeline"

urlpatterns = [
    path("transcribe/", TranscribeAudioView.as_view(), name="transcribe"),
]
