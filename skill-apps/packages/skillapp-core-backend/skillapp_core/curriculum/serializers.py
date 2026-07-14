from rest_framework import serializers

from .models import Lesson, LessonStep, Milestone, Module


class MilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = Milestone
        fields = ["id", "code", "title", "instructions_for_learner", "requires_video", "module", "lesson"]


class LessonStepSerializer(serializers.ModelSerializer):
    class Meta:
        model = LessonStep
        fields = ["id", "order", "caption", "photo_url", "image", "is_checklist_item"]


class LessonListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ["id", "code", "title", "order", "is_new_technique", "estimated_minutes"]


class LessonDetailSerializer(serializers.ModelSerializer):
    steps = LessonStepSerializer(many=True, read_only=True)
    milestones = MilestoneSerializer(many=True, read_only=True)

    class Meta:
        model = Lesson
        fields = [
            "id",
            "code",
            "title",
            "order",
            "instructions_text",
            "intro_video_url",
            "is_new_technique",
            "estimated_minutes",
            "steps",
            "milestones",
        ]


class ModuleListSerializer(serializers.ModelSerializer):
    lesson_count = serializers.IntegerField(source="lessons.count", read_only=True)

    class Meta:
        model = Module
        fields = ["id", "code", "title", "summary", "order", "year_index", "unlocks_after", "lesson_count"]
