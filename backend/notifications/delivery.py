import json
import logging
from typing import Iterable
from urllib import error, request

from django.utils import timezone

from core.models import DeviceRegistration
from users.models import ParentStudentLink

from .models import Notification

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def create_in_app_notification(*, user, notification_type: str, payload: dict) -> Notification:
    return Notification.objects.create(
        user=user,
        type=notification_type,
        channel=Notification.Channel.IN_APP,
        payload=payload,
        send_at=timezone.now(),
        status=Notification.Status.SENT,
    )


def _build_message_preview(*, body: str, transcript: str) -> str:
    preview = (body or transcript or "").strip()
    if not preview:
        return "Sent you a voice note."
    if len(preview) > 140:
        return f"{preview[:137]}..."
    return preview


def send_expo_push(*, push_tokens: Iterable[str], title: str, body: str, data: dict | None = None) -> None:
    messages = [
        {
            "to": token,
            "title": title,
            "body": body,
            "data": data or {},
            "sound": "default",
            "priority": "high",
        }
        for token in push_tokens
        if token
    ]
    if not messages:
        return
    payload = json.dumps(messages).encode("utf-8")
    req = request.Request(
        EXPO_PUSH_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=10) as response:
            response.read()
    except (error.URLError, TimeoutError, OSError) as exc:  # pragma: no cover - network best effort
        logger.warning("Expo push delivery failed: %s", exc)


def notify_submission_graded(*, submission, graded_by_user) -> None:
    assignment = submission.assignment
    student_profile = submission.student
    if not assignment or not student_profile or not getattr(student_profile, "user", None):
        return

    student_user = student_profile.user
    guardian_users = [
        link.parent.user
        for link in ParentStudentLink.objects.select_related("parent__user").filter(student=student_profile)
        if link.parent_id and getattr(link.parent, "user", None)
    ]
    recipients = [student_user, *guardian_users]

    grader_name = graded_by_user.display_name or graded_by_user.username
    unit_code = getattr(getattr(assignment, "unit", None), "code", "")
    title = f"New grade posted for {assignment.title}"
    feedback_text = (submission.feedback_text or "").strip()
    body = (
        f"{grader_name} graded {assignment.title}"
        f"{f' in {unit_code}' if unit_code else ''}: {submission.grade}."
    )
    if feedback_text:
        body = f"{body} Feedback: {feedback_text}"

    for recipient in recipients:
        create_in_app_notification(
            user=recipient,
            notification_type="submission_graded",
            payload={
                "title": title,
                "body": body,
                "assignment_id": assignment.id,
                "assignment_title": assignment.title,
                "submission_id": submission.id,
                "student_user_id": student_user.id,
                "student_name": student_user.display_name or student_user.username,
                "unit_id": getattr(assignment, "unit_id", None),
                "unit_code": unit_code,
                "grade": str(submission.grade),
                "feedback_text": feedback_text,
                "graded_by_user_id": graded_by_user.id,
                "graded_by_name": grader_name,
            },
        )

    push_tokens = list(
        DeviceRegistration.objects.filter(user__in=recipients).values_list("push_token", flat=True)
    )
    send_expo_push(
        push_tokens=push_tokens,
        title=title,
        body=body,
        data={
            "type": "submission_graded",
            "assignment_id": assignment.id,
            "submission_id": submission.id,
            "unit_id": getattr(assignment, "unit_id", None),
        },
    )


def notify_thread_message_received(*, message) -> None:
    thread = getattr(message, "thread", None)
    author = getattr(message, "author", None)
    if not thread or not author:
        return

    recipient_map = {}
    for participant in [thread.student, thread.teacher, thread.parent]:
        if not participant or participant.id == author.id:
            continue
        recipient_map[participant.id] = participant

    recipients = list(recipient_map.values())
    if not recipients:
        return

    sender_name = author.display_name or author.username
    title = f"New message from {sender_name}"
    thread_subject = (thread.subject or "").strip()
    body = _build_message_preview(body=message.body, transcript=message.transcript)

    for recipient in recipients:
        create_in_app_notification(
            user=recipient,
            notification_type="thread_message_received",
            payload={
                "title": title,
                "body": body,
                "thread_id": thread.id,
                "thread_subject": thread_subject,
                "message_id": message.id,
                "sender_user_id": author.id,
                "sender_name": sender_name,
                "sender_role": message.sender_role,
            },
        )

    push_tokens = list(
        DeviceRegistration.objects.filter(user__in=recipients).values_list("push_token", flat=True)
    )
    send_expo_push(
        push_tokens=push_tokens,
        title=title,
        body=body,
        data={
            "type": "thread_message_received",
            "thread_id": thread.id,
            "message_id": message.id,
            "sender_user_id": author.id,
            "sender_role": message.sender_role,
        },
    )
