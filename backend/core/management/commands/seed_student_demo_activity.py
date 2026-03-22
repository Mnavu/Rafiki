from datetime import datetime, timedelta, timezone as dt_timezone
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from communications.models import ChatMessage, CourseChatroom
from core.models import CalendarEvent
from learning.models import Assignment, LecturerAssignment, Registration, Timetable
from notifications.models import Notification
from users.models import ParentStudentLink

User = get_user_model()


class Command(BaseCommand):
    help = "Seed future classes, assignments, and a demo class call for a student."

    def add_arguments(self, parser):
        parser.add_argument("--username", default="student1")

    def handle(self, *args, **options):
        username = options["username"].strip()
        user = User.objects.filter(username=username).first()
        if not user or not hasattr(user, "student_profile"):
            raise CommandError(f"Student user '{username}' was not found.")

        student = user.student_profile
        registrations = list(
            Registration.objects.filter(
                student=student,
                status=Registration.Status.APPROVED,
            )
            .select_related("unit", "unit__programme")
            .order_by("unit__code")[:3]
        )
        if not registrations:
            raise CommandError(f"Student '{username}' has no approved registrations to seed.")

        now = timezone.localtime()
        seeded_timetables = 0
        seeded_assignments = 0
        seeded_calls = 0

        for index, registration in enumerate(registrations):
            unit = registration.unit
            lecturer_assignment = (
                LecturerAssignment.objects.select_related("lecturer", "lecturer__user")
                .filter(unit=unit)
                .order_by("academic_year", "trimester")
                .first()
            )
            if not lecturer_assignment:
                lecturer_profile = None
                if getattr(unit.programme, "department_id", None):
                    lecturer_profile = (
                        LecturerAssignment._meta.get_field("lecturer").related_model.objects.filter(
                            department_id=unit.programme.department_id
                        )
                        .first()
                    )
                if lecturer_profile is None:
                    lecturer_user = (
                        User.objects.filter(role=User.Roles.LECTURER)
                        .select_related("lecturer_profile")
                        .first()
                    )
                    lecturer_profile = getattr(lecturer_user, "lecturer_profile", None)
                if lecturer_profile is None:
                    raise CommandError(f"No lecturer assignment exists for {unit.code}.")
                lecturer_assignment = LecturerAssignment.objects.create(
                    lecturer=lecturer_profile,
                    unit=unit,
                    academic_year=now.year,
                    trimester=student.trimester,
                )

            lecturer_profile = lecturer_assignment.lecturer
            start_dt = (now + timedelta(days=index + 1)).replace(
                hour=9 + index,
                minute=0,
                second=0,
                microsecond=0,
            )
            end_dt = start_dt + timedelta(hours=2)

            _, created = Timetable.objects.get_or_create(
                programme=unit.programme,
                unit=unit,
                lecturer=lecturer_profile,
                start_datetime=start_dt.astimezone(dt_timezone.utc),
                defaults={
                    "room": f"Room {201 + index}",
                    "end_datetime": end_dt.astimezone(dt_timezone.utc),
                },
            )
            if created:
                seeded_timetables += 1

            assignment_defaults = [
                {
                    "title": f"{unit.code} short reflection",
                    "description": (
                        f"Write 4 to 6 sentences explaining the main idea from {unit.title}. "
                        "You can submit a written answer, a document link, or a voice answer with speech-to-text."
                    ),
                    "due_at": start_dt + timedelta(days=2),
                },
                {
                    "title": f"{unit.code} practice task",
                    "description": (
                        f"Share one example or case study for {unit.title}. "
                        "Use simple language and explain why your example fits the topic."
                    ),
                    "due_at": start_dt + timedelta(days=4),
                },
            ]
            if index == 0:
                assignment_defaults.append(
                    {
                        "title": f"{unit.code} CAT 1",
                        "description": (
                            f"Short CAT for {unit.title}. Answer briefly and clearly. "
                            "You may type your answer or use a voice response."
                        ),
                        "due_at": start_dt + timedelta(days=5),
                    }
                )

            for payload in assignment_defaults:
                _, created = Assignment.objects.get_or_create(
                    unit=unit,
                    lecturer=lecturer_profile,
                    title=payload["title"],
                    defaults={
                        "description": payload["description"],
                        "due_at": payload["due_at"].astimezone(dt_timezone.utc),
                    },
                )
                if created:
                    seeded_assignments += 1

            chatroom, _ = CourseChatroom.objects.get_or_create(unit=unit)
            if not chatroom.messages.exists():
                ChatMessage.objects.create(
                    chatroom=chatroom,
                    author_user=lecturer_profile.user,
                    message=f"Welcome to {unit.code} {unit.title}. Demo class updates will appear here.",
                )

            if index == 0:
                call_start = (now + timedelta(days=1)).replace(hour=14, minute=0, second=0, microsecond=0)
                call_end = call_start + timedelta(hours=1)
                source_id = f"demo-call-{username}-{unit.code.lower()}"
                meeting_url = f"https://meet.jit.si/eduassist-{unit.code.lower()}-{uuid4().hex[:8]}"
                participant_ids = {user.id, lecturer_profile.user_id}
                participant_ids.update(
                    ParentStudentLink.objects.filter(student=student).values_list("parent__user_id", flat=True)
                )

                for participant_id in participant_ids:
                    CalendarEvent.objects.update_or_create(
                        owner_user_id=participant_id,
                        source_type="class_call",
                        source_id=source_id,
                        defaults={
                            "title": f"{unit.code} live class",
                            "description": f"Demo online class for {unit.title}",
                            "start_at": call_start.astimezone(dt_timezone.utc),
                            "end_at": call_end.astimezone(dt_timezone.utc),
                            "timezone_hint": "Africa/Nairobi",
                            "metadata": {
                                "unit_id": unit.id,
                                "unit_code": unit.code,
                                "unit_title": unit.title,
                                "meeting_url": meeting_url,
                                "scheduled_by_user_id": lecturer_profile.user_id,
                            },
                            "is_active": True,
                        },
                    )
                    Notification.objects.create(
                        user_id=participant_id,
                        type="class_call_scheduled",
                        channel=Notification.Channel.IN_APP,
                        payload={
                            "source_id": source_id,
                            "title": f"{unit.code} live class",
                            "unit_id": unit.id,
                            "unit_code": unit.code,
                            "meeting_url": meeting_url,
                            "start_at": call_start.isoformat(),
                            "end_at": call_end.isoformat(),
                        },
                        send_at=timezone.now(),
                        status=Notification.Status.SENT,
                    )

                ChatMessage.objects.create(
                    chatroom=chatroom,
                    author_user=lecturer_profile.user,
                    message=(
                        f"Demo class call ready for {unit.code}. "
                        f"Starts {call_start.strftime('%a %d %b %I:%M %p')}. Join: {meeting_url}"
                    ),
                )
                seeded_calls += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded demo activity for {username}: "
                f"{seeded_timetables} future classes, {seeded_assignments} assignments, {seeded_calls} class call."
            )
        )
