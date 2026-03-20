from django.utils import timezone

from communications.models import CourseChatroom, ChatMessage, Thread
from finance.models import FinanceStatus
from users.models import Student

from .models import CurriculumUnit, LecturerAssignment, Registration, TermOffering

COMMUNITY_ELIGIBLE_REGISTRATION_STATUSES = (
    Registration.Status.SUBMITTED,
    Registration.Status.PENDING_HOD,
    Registration.Status.APPROVED,
)


def get_current_term_year(student: Student) -> int:
    if not student.programme_id:
        return timezone.now().year
    return (
        TermOffering.objects.filter(
            programme=student.programme,
            trimester=student.trimester,
            offered=True,
        )
        .order_by("-academic_year")
        .values_list("academic_year", flat=True)
        .first()
        or timezone.now().year
    )


def get_offered_units_for_student(student: Student, *, limit: int | None = None) -> list[CurriculumUnit]:
    if not student.programme_id:
        return []

    academic_year = get_current_term_year(student)
    offerings = list(
        TermOffering.objects.filter(
            programme=student.programme,
            academic_year=academic_year,
            trimester=student.trimester,
            offered=True,
        )
        .select_related("unit")
        .order_by("unit__code")
    )
    units = [offering.unit for offering in offerings if offering.unit_id]
    if not units:
        fallback = CurriculumUnit.objects.filter(
            programme=student.programme,
            trimester_hint=student.trimester,
        ).order_by("code")
        units = list(fallback[: limit or 4])
    elif limit is not None:
        units = units[:limit]
    return units


def get_or_create_lecturer_assignments(
    unit: CurriculumUnit,
    *,
    academic_year: int,
    trimester: int,
) -> list[LecturerAssignment]:
    assignments = list(
        LecturerAssignment.objects.filter(
            unit=unit,
            academic_year=academic_year,
            trimester=trimester,
        ).select_related("lecturer__user")
    )
    if assignments:
        return assignments

    lecturer_qs = (
        unit.programme.department.lecturer_set.select_related("user").all()
        if unit.programme_id and unit.programme.department_id
        else []
    )
    lecturers = list(lecturer_qs)
    if not lecturers:
        return []

    assignment, _ = LecturerAssignment.objects.get_or_create(
        lecturer=lecturers[0],
        unit=unit,
        academic_year=academic_year,
        trimester=trimester,
    )
    return [assignment]


def ensure_registration_channels(registration: Registration) -> None:
    if not registration.student_id or not registration.unit_id:
        return

    student = registration.student
    student_user = student.user
    unit = registration.unit
    chatroom, _ = CourseChatroom.objects.get_or_create(unit=unit)

    assignments = get_or_create_lecturer_assignments(
        unit,
        academic_year=registration.academic_year,
        trimester=registration.trimester,
    )
    if not assignments:
        return

    parent_links = list(student.parent_links.select_related("parent__user"))
    for assignment in assignments:
        lecturer_user = assignment.lecturer.user
        if not chatroom.messages.exists():
            ChatMessage.objects.create(
                chatroom=chatroom,
                author_user=lecturer_user,
                message=(
                    f"Welcome to {unit.code}. This class community is ready for course updates, "
                    "questions, and lecturer announcements."
                ),
            )
        Thread.objects.get_or_create(
            student=student_user,
            teacher=lecturer_user,
            parent=None,
            defaults={"subject": f"{unit.code} lecturer channel"},
        )
        for link in parent_links:
            Thread.objects.get_or_create(
                student=student_user,
                teacher=lecturer_user,
                parent=link.parent.user,
                defaults={"subject": f"{unit.code} guardian channel"},
            )


def ensure_student_access(
    student: Student,
    *,
    bootstrap_count: int = 3,
) -> list[Registration]:
    academic_year = get_current_term_year(student)
    registrations = list(
        Registration.objects.filter(
            student=student,
            academic_year=academic_year,
            trimester=student.trimester,
            status__in=COMMUNITY_ELIGIBLE_REGISTRATION_STATUSES,
        ).select_related("unit", "student__user")
    )

    if not registrations:
        for unit in get_offered_units_for_student(student, limit=bootstrap_count):
            registration, _ = Registration.objects.update_or_create(
                student=student,
                unit=unit,
                academic_year=academic_year,
                trimester=student.trimester,
                defaults={
                    "status": Registration.Status.APPROVED,
                    "approved_at": timezone.now(),
                },
            )
            registrations.append(registration)

    for registration in registrations:
        ensure_registration_channels(registration)

    FinanceStatus.objects.update_or_create(
        student=student,
        academic_year=academic_year,
        trimester=student.trimester,
        defaults={
            "total_due": "120000.00",
            "total_paid": "90000.00",
            "status": FinanceStatus.Status.PARTIAL,
            "clearance_status": FinanceStatus.Clearance.CLEARED_FOR_REGISTRATION,
        },
    )

    statuses = {registration.status for registration in registrations}
    if Registration.Status.APPROVED in statuses:
        next_status = Student.Status.ACTIVE
    elif (
        Registration.Status.PENDING_HOD in statuses
        or Registration.Status.SUBMITTED in statuses
    ):
        next_status = Student.Status.PENDING_HOD
    else:
        next_status = Student.Status.FINANCE_OK

    if student.current_status != next_status:
        student.current_status = next_status
        student.save(update_fields=["current_status"])

    return registrations
