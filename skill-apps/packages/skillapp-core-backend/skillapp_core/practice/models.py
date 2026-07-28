from django.conf import settings
from django.db import models

from skillapp_core.curriculum.models import Lesson, LessonStep


class ChecklistCompletion(models.Model):
    """A learner (or their mentor, on their behalf) marking a practice step done.

    `practice_count` increments on repeat taps so "practice to perfection" style
    lessons (repeated mat-making steps with no new video) can show how many
    times a step has been repeated, not just a done/not-done boolean.
    """

    learner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="checklist_completions")
    lesson_step = models.ForeignKey(LessonStep, on_delete=models.CASCADE, related_name="completions")
    marked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="+"
    )
    practice_count = models.PositiveIntegerField(default=1)
    completed_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["learner", "lesson_step"], name="unique_learner_step_completion")
        ]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.learner_id} completed step {self.lesson_step_id} x{self.practice_count}"


class LearnerLessonProgress(models.Model):
    class Status(models.TextChoices):
        NOT_STARTED = "not_started", "Not started"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"

    learner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="lesson_progress")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="learner_progress")
    steps_completed = models.PositiveIntegerField(default=0)
    steps_total = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_STARTED)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["learner", "lesson"], name="unique_learner_lesson_progress")
        ]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.learner_id} / {self.lesson.code}: {self.status}"
