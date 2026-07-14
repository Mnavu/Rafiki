from rest_framework import serializers

from .models import LearnerLessonProgress


class LearnerLessonProgressSerializer(serializers.ModelSerializer):
    lesson_code = serializers.CharField(source="lesson.code", read_only=True)
    module_code = serializers.CharField(source="lesson.module.code", read_only=True)

    class Meta:
        model = LearnerLessonProgress
        fields = [
            "id",
            "lesson_code",
            "module_code",
            "steps_completed",
            "steps_total",
            "status",
            "completed_at",
        ]
