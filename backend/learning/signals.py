from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone

from core.services import (
    notify_users,
    remove_calendar_events_for_source,
    upsert_calendar_events_for_users,
)
from learning.models import Assignment, Registration


def _unique_users(users):
    seen = set()
    deduped = []
    for user in users:
        user_id = getattr(user, "id", None)
        if not user_id or user_id in seen:
            continue
        seen.add(user_id)
        deduped.append(user)
    return deduped


@receiver(post_save, sender=Assignment)
def assignment_upsert(sender, instance: Assignment, created, **kwargs):
    if kwargs.get("raw"):
        return

    owners = []
    if instance.lecturer_id:
        owners.append(instance.lecturer)
    course = getattr(instance.unit, "course", None)
    if course:
        enrollments = course.enrollments.select_related("student").all()
        owners.extend([enrollment.student for enrollment in enrollments])

    owners = _unique_users(owners)

    if not owners:
        return

    start_at = instance.due_at or timezone.now()
    upsert_calendar_events_for_users(
        owners,
        source_type="assignment",
        source_id=str(instance.id),
        title=f"{instance.unit.title}: {instance.title}",
        start_at=start_at,
        description=instance.description,
        metadata={"assignment_id": instance.id, "status": instance.status},
    )

    if created:
        notify_users(
            owners,
            "New assignment posted",
            f"{instance.title} is available. Due {start_at.strftime('%Y-%m-%d %H:%M')}",
            kind="assignment",
        )


@receiver(post_delete, sender=Assignment)
def assignment_removed(sender, instance: Assignment, **kwargs):
    remove_calendar_events_for_source("assignment", str(instance.id))


@receiver(post_save, sender=Registration)
def registration_updated(sender, instance: Registration, created, **kwargs):
    if kwargs.get("raw"):
        return

    if instance.status != "approved":
        if not created:
            remove_calendar_events_for_source("registration", str(instance.id))
        return

    owners = [instance.student]
    parents = [
        link.parent for link in instance.student.parent_links.select_related("parent").all()
    ]
    owners.extend(parents)
    owners = _unique_users(owners)

    upsert_calendar_events_for_users(
        owners,
        source_type="registration",
        source_id=str(instance.id),
        title=f"Registration approved: {instance.unit.title}",
        start_at=timezone.now(),
        description=f"{instance.unit.title} registration approved for {instance.academic_year} T{instance.trimester}",
        metadata={
            "registration_id": instance.id,
            "unit": instance.unit_id,
            "status": instance.status,
        },
    )

    notify_users(
        owners,
        "Registration approved",
        f"You are cleared for {instance.unit.title}.",
        kind="registration",
    )


@receiver(post_delete, sender=Registration)
def registration_deleted(sender, instance: Registration, **kwargs):
    remove_calendar_events_for_source("registration", str(instance.id))
