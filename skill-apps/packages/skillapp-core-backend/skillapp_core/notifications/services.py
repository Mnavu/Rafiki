"""Decoupled notify-on-review hook, mirroring Nanu's notifications/delivery.py
shape: callers (submissions views) fire-and-forget these calls without
importing notifications models directly at module level.
"""
from .models import Notification


def notify_submission_reviewed(submission) -> None:
    Notification.objects.create(
        recipient=submission.learner,
        verb=f"Your submission for '{submission.milestone.title}' was {submission.status}.",
        submission=submission,
    )


def notify_new_submission(submission, mentor_ids) -> None:
    Notification.objects.bulk_create(
        [
            Notification(
                recipient_id=mentor_id,
                verb=f"New milestone submission waiting for review: {submission.milestone.title}",
                submission=submission,
            )
            for mentor_id in mentor_ids
        ]
    )
