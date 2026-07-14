from rest_framework import serializers

from .models import MilestoneSubmission


class MilestoneSubmissionSerializer(serializers.ModelSerializer):
    milestone_title = serializers.CharField(source="milestone.title", read_only=True)
    learner_username = serializers.CharField(source="learner.username", read_only=True)

    class Meta:
        model = MilestoneSubmission
        fields = [
            "id",
            "learner",
            "learner_username",
            "milestone",
            "milestone_title",
            "photo",
            "video",
            "learner_note_text",
            "learner_audio",
            "learner_audio_transcript",
            "status",
            "first_submitted_at",
            "last_submitted_at",
            "reviewed_by",
            "reviewed_at",
            "feedback_text",
            "feedback_audio",
        ]
        read_only_fields = [
            "id",
            "learner",
            "learner_username",
            "milestone_title",
            "status",
            "first_submitted_at",
            "last_submitted_at",
            "reviewed_by",
            "reviewed_at",
            "feedback_text",
            "feedback_audio",
        ]


class SubmissionReviewSerializer(serializers.Serializer):
    STATUS_CHOICES = ("approved", "needs_changes")

    status = serializers.ChoiceField(choices=STATUS_CHOICES)
    feedback_text = serializers.CharField(required=False, allow_blank=True)
    feedback_audio = serializers.FileField(required=False)
    award_points = serializers.IntegerField(required=False, default=0, min_value=0)
    badge_code = serializers.CharField(required=False, allow_blank=True)
