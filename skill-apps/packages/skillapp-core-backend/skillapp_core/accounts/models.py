"""Reusable, abstract account building blocks shared across every skill app.

Django requires exactly one concrete AUTH_USER_MODEL per project, so this module
ships abstract base classes only. Each skill app (e.g. Beadwork Academy) defines
its own concrete `User(AbstractSkillUser)` and `MentorLearnerLink(AbstractMentorLearnerLink)`
in its own local `accounts` app, then points `settings.SKILLAPP_MENTOR_LINK_MODEL`
at its concrete link model so the shared permission helpers in this package can
resolve it (mirrors Django's own AUTH_USER_MODEL swappable-model pattern).
"""
from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models


class Roles(models.TextChoices):
    LEARNER = "learner", "Learner"
    MENTOR = "mentor", "Mentor"


class AbstractSkillUser(AbstractUser):
    """Common fields every skill app's concrete User model should carry."""

    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.LEARNER)
    prefers_simple_language = models.BooleanField(default=True)
    prefers_high_contrast = models.BooleanField(default=False)
    speech_rate = models.FloatField(default=0.9)

    class Meta:
        abstract = True

    @property
    def is_learner(self) -> bool:
        return self.role == Roles.LEARNER

    @property
    def is_mentor(self) -> bool:
        return self.role == Roles.MENTOR


class Relationship(models.TextChoices):
    PARENT = "parent", "Parent / guardian"
    INSTRUCTOR = "instructor", "Instructor"
    OTHER = "other", "Other"


class AbstractMentorLearnerLink(models.Model):
    """Mirrors Nanu's `ParentStudentLink` through-table pattern.

    A learner can have multiple mentors (parent + instructor, etc.); `can_review`
    lets a link exist for progress-viewing only, without granting review rights
    (e.g. an observing relative who shouldn't approve milestones).
    """

    mentor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_as_mentor",
    )
    learner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_as_learner",
    )
    relationship = models.CharField(max_length=20, choices=Relationship.choices, default=Relationship.PARENT)
    can_review = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract = True
        constraints = [
            models.UniqueConstraint(fields=["mentor", "learner"], name="%(app_label)s_%(class)s_unique_link")
        ]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.mentor_id} -> {self.learner_id} ({self.relationship})"
