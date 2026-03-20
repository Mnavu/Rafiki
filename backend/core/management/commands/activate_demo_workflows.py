from django.core.management.base import BaseCommand
from django.db import transaction

from communications.models import CourseChatroom, Thread
from core.models import Department
from learning.models import Registration
from learning.workflows import (
    ensure_registration_channels,
    ensure_student_access,
    get_current_term_year,
    get_offered_units_for_student,
    get_or_create_lecturer_assignments,
)
from users.models import Guardian, HOD, ParentStudentLink, Student, User


class Command(BaseCommand):
    help = (
        "Activate demo workflows for current users: map demo HOD, ensure class communities and lecturer "
        "threads for students, and create pending HOD approvals for at least one demo student."
    )

    def add_arguments(self, parser):
        parser.add_argument("--department-code", default="TT")
        parser.add_argument("--hod-username", default="hod1")
        parser.add_argument("--student-username", default="student1")
        parser.add_argument("--guardian-username", default="parent1")
        parser.add_argument("--all-students", action="store_true")
        parser.add_argument("--bootstrap-count", type=int, default=3)

    def handle(self, *args, **options):
        department_code = options["department_code"]
        hod_username = options["hod_username"]
        student_username = options["student_username"]
        guardian_username = options["guardian_username"]
        all_students = options["all_students"]
        bootstrap_count = max(options["bootstrap_count"], 1)

        with transaction.atomic():
            self._activate(
                department_code=department_code,
                hod_username=hod_username,
                student_username=student_username,
                guardian_username=guardian_username,
                all_students=all_students,
                bootstrap_count=bootstrap_count,
            )

    def _activate(
        self,
        *,
        department_code: str,
        hod_username: str,
        student_username: str,
        guardian_username: str,
        all_students: bool,
        bootstrap_count: int,
    ):
        department = Department.objects.filter(code=department_code).first()
        if not department:
            self.stdout.write(self.style.ERROR(f"Department {department_code} not found."))
            return

        hod_user = User.objects.filter(username=hod_username, role=User.Roles.HOD).first()
        if hod_user:
            hod_profile, _ = HOD.objects.get_or_create(user=hod_user)
            current_hod = HOD.objects.filter(department=department).exclude(user=hod_user).first()
            if current_hod:
                current_hod.department = None
                current_hod.save(update_fields=["department"])
            if hod_profile.department_id != department.id:
                hod_profile.department = department
                hod_profile.save(update_fields=["department"])
            if department.head_of_department_id != hod_profile.user_id:
                department.head_of_department = hod_profile
                department.save(update_fields=["head_of_department"])
            self.stdout.write(self.style.SUCCESS(f"Mapped HOD {hod_username} to department {department.code}."))
        else:
            self.stdout.write(self.style.WARNING(f"HOD user {hod_username} not found."))

        student_user = User.objects.filter(username=student_username, role=User.Roles.STUDENT).first()
        guardian_user = User.objects.filter(username=guardian_username, role=User.Roles.PARENT).first()
        if student_user and guardian_user:
            guardian_profile, _ = Guardian.objects.get_or_create(user=guardian_user)
            student_profile = student_user.student_profile
            ParentStudentLink.objects.get_or_create(
                parent=guardian_profile,
                student=student_profile,
                defaults={"relationship": "Guardian"},
            )
            self.stdout.write(self.style.SUCCESS(f"Linked {guardian_username} to {student_username}."))

        if all_students:
            department_students = Student.objects.select_related("user", "programme").filter(
                programme__department=department
            )
            activated_count = 0
            for student in department_students:
                registrations = ensure_student_access(student, bootstrap_count=bootstrap_count)
                activated_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Activated {student.user.username} with {len(registrations)} accessible registrations."
                    )
                )
            if not activated_count:
                self.stdout.write(self.style.WARNING("No students were found in the selected department."))
        else:
            self._ensure_student_channels(student_user, bootstrap_count=bootstrap_count)
        self._ensure_demo_hod_queue(department, exclude_username=student_username)

    def _ensure_student_channels(self, student_user: User | None, *, bootstrap_count: int):
        if not student_user or not hasattr(student_user, "student_profile"):
            return

        student = student_user.student_profile
        registrations = ensure_student_access(student, bootstrap_count=bootstrap_count)
        if not registrations:
            self.stdout.write(self.style.WARNING(f"No offered units found for {student_user.username}."))
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Activated starter channels and class access for {student_user.username}."
            )
        )

    def _ensure_demo_hod_queue(self, department: Department, *, exclude_username: str):
        candidate = (
            Student.objects.select_related("user", "programme")
            .filter(
                user__username__startswith="demo_",
                programme__department=department,
                current_status__in=[Student.Status.FINANCE_OK, Student.Status.ACTIVE],
            )
            .exclude(user__username=exclude_username)
            .order_by("user__username")
            .first()
        )
        if not candidate:
            self.stdout.write(self.style.WARNING("No finance-cleared demo student found for HOD approval queue."))
            return

        academic_year = get_current_term_year(candidate)
        offered_units = get_offered_units_for_student(candidate, limit=2)
        if not offered_units:
            self.stdout.write(self.style.WARNING(f"No offered units found for {candidate.user.username}."))
            return

        for unit in offered_units:
            CourseChatroom.objects.get_or_create(unit=unit)
            for assignment in get_or_create_lecturer_assignments(
                unit,
                academic_year=academic_year,
                trimester=candidate.trimester,
            ):
                Thread.objects.get_or_create(
                    student=candidate.user,
                    teacher=assignment.lecturer.user,
                    parent=None,
                    defaults={"subject": f"{unit.code} lecturer channel"},
                )
            registration, _ = Registration.objects.update_or_create(
                student=candidate,
                unit=unit,
                academic_year=academic_year,
                trimester=candidate.trimester,
                defaults={
                    "status": Registration.Status.PENDING_HOD,
                    "approved_by": None,
                    "approved_at": None,
                },
            )
            registration.status = Registration.Status.PENDING_HOD
            registration.approved_by = None
            registration.approved_at = None
            registration.save(update_fields=["status", "approved_by", "approved_at"])
            ensure_registration_channels(registration)

        if candidate.current_status != Student.Status.PENDING_HOD:
            candidate.current_status = Student.Status.PENDING_HOD
            candidate.save(update_fields=["current_status"])

        self.stdout.write(
            self.style.SUCCESS(
                f"Prepared {candidate.user.username} with pending HOD registrations for approval testing."
            )
        )
