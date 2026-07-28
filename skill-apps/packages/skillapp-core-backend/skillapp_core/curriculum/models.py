"""Generic curriculum content model, shared by every skill app.

Deliberately skill-agnostic naming (Module/Lesson/LessonStep/Milestone, not
"BeadModule" etc.) so a second skill app can add its own seed data without
touching this package. Progression is linear (order + a single self-FK
`unlocks_after` for year-1 -> year-2 gating) rather than a prerequisite DAG,
matching the linear 2-year course structure described for Beadwork Academy.
"""
from django.db import models


class Module(models.Model):
    code = models.CharField(max_length=40, unique=True)
    title = models.CharField(max_length=200)
    summary = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    year_index = models.PositiveSmallIntegerField(default=1)
    unlocks_after = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="unlocked_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["year_index", "order"]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.code}: {self.title}"


class Lesson(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="lessons")
    code = models.CharField(max_length=40, unique=True)
    title = models.CharField(max_length=200)
    order = models.PositiveIntegerField(default=0)
    instructions_text = models.TextField(blank=True)
    intro_video_url = models.URLField(blank=True)
    is_new_technique = models.BooleanField(
        default=False,
        help_text="If true, the lesson player shows intro_video_url the first time; otherwise it's a practice repeat (photo-steps only).",
    )
    estimated_minutes = models.PositiveIntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["module__order", "order"]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.code}: {self.title}"


class LessonStep(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="steps")
    order = models.PositiveIntegerField(default=0)
    caption = models.CharField(max_length=300)
    photo_url = models.URLField(blank=True)
    image = models.ImageField(upload_to="curriculum/steps/", null=True, blank=True)
    is_checklist_item = models.BooleanField(default=True)

    class Meta:
        ordering = ["lesson_id", "order"]

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.lesson.code} step {self.order}: {self.caption}"


class Milestone(models.Model):
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name="milestones", null=True, blank=True)
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="milestones", null=True, blank=True)
    code = models.CharField(max_length=40, unique=True)
    title = models.CharField(max_length=200)
    instructions_for_learner = models.TextField(blank=True)
    requires_video = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"{self.code}: {self.title}"
