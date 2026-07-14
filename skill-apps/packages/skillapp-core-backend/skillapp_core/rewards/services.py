from django.db.models import Sum

from .models import Award, Badge


def award_for_submission(*, submission, awarded_by, points: int, badge_code: str = "", reason: str = "") -> Award:
    badge = None
    if badge_code:
        badge, _ = Badge.objects.get_or_create(code=badge_code, defaults={"title": badge_code})

    return Award.objects.create(
        learner=submission.learner,
        awarded_by=awarded_by,
        badge=badge,
        points=points,
        reason=reason,
        source_submission=submission,
    )


def stars_total_for(learner) -> int:
    return Award.objects.filter(learner=learner).aggregate(total=Sum("points"))["total"] or 0
