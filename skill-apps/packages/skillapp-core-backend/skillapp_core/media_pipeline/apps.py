from django.apps import AppConfig


class MediaPipelineConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "skillapp_core.media_pipeline"
    label = "skillapp_core_media_pipeline"
    verbose_name = "Skill App Core - Media Pipeline"
