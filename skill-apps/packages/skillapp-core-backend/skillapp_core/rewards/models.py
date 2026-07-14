"""Mirrors Nanu's rewards.Merit ledger pattern: an append-only Award row per
grant. Unlike Merit, this package keeps the running total as an on-demand
aggregate (Sum of Award.points) rather than a denormalized counter field on a
per-app profile model, so `rewards` stays fully self-contained (FK straight to
settings.AUTH_USER_MODEL) instead of depending on each app's own concrete
LearnerProfile model. At this scale a `Sum()` aggregate is cheap; a
denormalized counter can be added later per-app if it's ever needed.
"""
from django.conf import settings
from django.db import models


class Badge(models.Model):
    code = models.CharField(max_length=40, unique=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    icon_url = models.URLField(blank=True)
    criteria_hint = models.CharField(max_length=300, blank=True)

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.code}: {self.title}"


class Award(models.Model):
    learner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="awards")
    awarded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    badge = models.ForeignKey(Badge, on_delete=models.SET_NULL, null=True, blank=True, related_name="awards")
    points = models.PositiveIntegerField(default=0)
    reason = models.CharField(max_length=300, blank=True)
    source_submission = models.ForeignKey(
        "skillapp_core_submissions.MilestoneSubmission",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="awards",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.learner_id}: +{self.points} ({self.reason})"
