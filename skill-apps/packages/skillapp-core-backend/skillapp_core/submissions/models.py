"""Mirrors Nanu's learning.Submission pattern: one row carries both the
learner's artifact and the reviewer's response. Upsert-on-resubmit keeps a
single row per (learner, milestone) rather than growing a duplicate history.
"""
from django.conf import settings
from django.db import models

from skillapp_core.curriculum.models import Milestone


class SubmissionStatus(models.TextChoices):
    PENDING = "pending", "Waiting for review"
    APPROVED = "approved", "Approved"
    NEEDS_CHANGES = "needs_changes", "Needs changes"


class MilestoneSubmission(models.Model):
    learner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="milestone_submissions")
    milestone = models.ForeignKey(Milestone, on_delete=models.CASCADE, related_name="submissions")

    photo = models.ImageField(upload_to="submissions/photos/", null=True, blank=True)
    video = models.FileField(upload_to="submissions/videos/", null=True, blank=True)
    learner_note_text = models.TextField(blank=True)
    learner_audio = models.FileField(upload_to="submissions/audio/", null=True, blank=True)
    learner_audio_transcript = models.TextField(blank=True)

    status = models.CharField(max_length=20, choices=SubmissionStatus.choices, default=SubmissionStatus.PENDING)
    first_submitted_at = models.DateTimeField(auto_now_add=True)
    last_submitted_at = models.DateTimeField(auto_now=True)

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    feedback_text = models.TextField(blank=True)
    feedback_audio = models.FileField(upload_to="submissions/feedback_audio/", null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["learner", "milestone"], name="unique_learner_milestone_submission")
        ]
        ordering = ["-last_submitted_at"]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.learner_id} / {self.milestone.code}: {self.status}"
