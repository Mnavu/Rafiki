from django.conf import settings
from django.db import models
from core.models import TimeStampedModel
from learning.models import CurriculumUnit, Programme


class Conversation(TimeStampedModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations")
    title = models.CharField(max_length=255, blank=True)
    state = models.JSONField(default=dict, blank=True)


class Turn(TimeStampedModel):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="turns")
    sender = models.CharField(max_length=20, default="user")  # user|bot
    text = models.TextField()


class ChatbotAnswerFeedback(TimeStampedModel):
    class Rating(models.TextChoices):
        HELPFUL = "helpful", "Helpful"
        NOT_HELPFUL = "not_helpful", "Not Helpful"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="chatbot_feedback",
    )
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="feedback_entries",
    )
    turn = models.ForeignKey(
        Turn,
        on_delete=models.CASCADE,
        related_name="feedback_entries",
    )
    rating = models.CharField(max_length=20, choices=Rating.choices)
    query_text = models.TextField(blank=True)
    answer_text = models.TextField()
    visual_cue = models.CharField(max_length=64, blank=True)
    navigation_target = models.CharField(max_length=64, blank=True)
    needs_review = models.BooleanField(default=False)
    admin_notes = models.TextField(blank=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_chatbot_feedback",
    )

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("user", "turn")

    def __str__(self):
        return f"{self.user_id} - {self.rating} - turn {self.turn_id}"


class CourseRevisionKnowledge(TimeStampedModel):
    programme = models.ForeignKey(
        Programme,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="revision_knowledge_entries",
    )
    unit = models.ForeignKey(
        CurriculumUnit,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="revision_knowledge_entries",
    )
    topic_title = models.CharField(max_length=255)
    trigger_phrases = models.TextField(
        blank=True,
        help_text="Comma-separated student phrases or keywords that should map to this topic.",
    )
    explanation = models.TextField()
    revision_tips = models.TextField(blank=True)
    practice_prompt = models.TextField(blank=True)
    priority = models.PositiveIntegerField(default=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["priority", "topic_title"]

    def __str__(self):
        prefix = self.unit.code if self.unit_id else (self.programme.code if self.programme_id else "GENERAL")
        return f"{prefix} - {self.topic_title}"
