from django.db import transaction
from django.utils import timezone

from skillapp_core.curriculum.models import LessonStep

from .models import ChecklistCompletion, LearnerLessonProgress


@transaction.atomic
def mark_step_complete(*, learner, lesson_step: LessonStep, marked_by) -> ChecklistCompletion:
    completion, created = ChecklistCompletion.objects.get_or_create(
        learner=learner,
        lesson_step=lesson_step,
        defaults={"marked_by": marked_by, "practice_count": 1},
    )
    if not created:
        completion.practice_count += 1
        completion.marked_by = marked_by
        completion.save(update_fields=["practice_count", "marked_by", "completed_at"])

    _recompute_lesson_progress(learner=learner, lesson=lesson_step.lesson)
    return completion


def _recompute_lesson_progress(*, learner, lesson) -> LearnerLessonProgress:
    checklist_step_ids = list(
        lesson.steps.filter(is_checklist_item=True).values_list("id", flat=True)
    )
    steps_total = len(checklist_step_ids)
    steps_completed = ChecklistCompletion.objects.filter(
        learner=learner, lesson_step_id__in=checklist_step_ids
    ).count()

    if steps_total == 0:
        status = LearnerLessonProgress.Status.NOT_STARTED
    elif steps_completed >= steps_total:
        status = LearnerLessonProgress.Status.COMPLETED
    else:
        status = LearnerLessonProgress.Status.IN_PROGRESS

    progress, _ = LearnerLessonProgress.objects.update_or_create(
        learner=learner,
        lesson=lesson,
        defaults={
            "steps_completed": steps_completed,
            "steps_total": steps_total,
            "status": status,
            "completed_at": timezone.now() if status == LearnerLessonProgress.Status.COMPLETED else None,
        },
    )
    return progress
