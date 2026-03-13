from __future__ import annotations

from collections import defaultdict
import re

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from learning.models import Programme
from users.models import Guardian, ParentStudentLink, Student


User = get_user_model()
DEMO_USERNAME_PATTERN = re.compile(r"^demo_[a-z0-9_]+_y\d+_\d+$")


class Command(BaseCommand):
    help = "Backfill existing students across years and create deterministic demo students by year."

    def add_arguments(self, parser):
        parser.add_argument(
            "--per-year",
            type=int,
            default=2,
            help="Number of demo students to create per programme year (default: 2).",
        )
        parser.add_argument(
            "--trimester",
            type=int,
            default=1,
            help="Default trimester for generated demo students (default: 1).",
        )
        parser.add_argument(
            "--password",
            type=str,
            default="Demo@2026",
            help="Password for generated demo users (default: Demo@2026).",
        )
        parser.add_argument(
            "--skip-backfill",
            action="store_true",
            help="Skip redistributing existing students and only create demo students.",
        )
        parser.add_argument(
            "--no-guardians",
            action="store_true",
            help="Do not create guardian users/links for generated demo students.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print planned actions without persisting changes.",
        )
        parser.add_argument(
            "--programme-code",
            type=str,
            default="",
            help="Optional programme code filter (e.g. CTT01).",
        )

    def handle(self, *args, **options):
        per_year = options["per_year"]
        trimester = options["trimester"]
        password = options["password"]
        skip_backfill = options["skip_backfill"]
        no_guardians = options["no_guardians"]
        dry_run = options["dry_run"]
        programme_code = (options["programme_code"] or "").strip()

        if per_year < 1:
            raise CommandError("--per-year must be at least 1.")
        if trimester < 1:
            raise CommandError("--trimester must be at least 1.")

        programmes = Programme.objects.all().order_by("code")
        programme_filter_enabled = False
        if programme_code:
            programmes = programmes.filter(code__iexact=programme_code)
            programme_filter_enabled = True
            if not programmes.exists():
                raise CommandError(f"No programme found with code '{programme_code}'.")

        self.stdout.write(self.style.MIGRATE_HEADING("Student year distribution seeding"))
        self.stdout.write(
            f"Settings -> per_year={per_year}, trimester={trimester}, "
            f"skip_backfill={skip_backfill}, create_guardians={not no_guardians}, dry_run={dry_run}"
        )

        if dry_run:
            self._run(
                programmes=programmes,
                per_year=per_year,
                trimester=trimester,
                password=password,
                skip_backfill=skip_backfill,
                no_guardians=no_guardians,
                dry_run=True,
                programme_filter_enabled=programme_filter_enabled,
            )
            self.stdout.write(self.style.WARNING("Dry run complete. No changes were saved."))
            return

        with transaction.atomic():
            self._run(
                programmes=programmes,
                per_year=per_year,
                trimester=trimester,
                password=password,
                skip_backfill=skip_backfill,
                no_guardians=no_guardians,
                dry_run=False,
                programme_filter_enabled=programme_filter_enabled,
            )
        self.stdout.write(self.style.SUCCESS("Student year distribution seeding completed."))

    def _run(
        self,
        *,
        programmes,
        per_year: int,
        trimester: int,
        password: str,
        skip_backfill: bool,
        no_guardians: bool,
        dry_run: bool,
        programme_filter_enabled: bool,
    ):
        if not skip_backfill:
            self._backfill_existing_students(
                programmes=programmes,
                dry_run=dry_run,
                trimester=trimester,
                programme_filter_enabled=programme_filter_enabled,
            )
        self._create_demo_students(
            programmes=programmes,
            per_year=per_year,
            trimester=trimester,
            password=password,
            no_guardians=no_guardians,
            dry_run=dry_run,
        )

    def _programme_max_year(self, programme: Programme | None) -> int:
        if programme and programme.duration_years and programme.duration_years > 0:
            return int(programme.duration_years)
        return 2

    def _trimester_label(self, year: int, trimester: int) -> str:
        return f"Year {year}, Trimester {trimester}"

    def _backfill_existing_students(
        self,
        *,
        programmes,
        dry_run: bool,
        trimester: int,
        programme_filter_enabled: bool,
    ):
        self.stdout.write(self.style.MIGRATE_HEADING("Backfilling existing students across years"))
        programme_ids = list(programmes.values_list("id", flat=True))

        students = Student.objects.select_related("user", "programme").order_by("user__username")
        if programme_filter_enabled and programme_ids:
            students = students.filter(programme_id__in=programme_ids)

        grouped: dict[int | None, list[Student]] = defaultdict(list)
        for student in students:
            if DEMO_USERNAME_PATTERN.match(student.user.username):
                continue
            grouped[student.programme_id].append(student)

        total_updated = 0
        for programme_id, rows in grouped.items():
            programme = rows[0].programme if rows and rows[0].programme_id else None
            max_year = self._programme_max_year(programme)
            for index, student in enumerate(rows):
                assigned_year = (index % max_year) + 1
                assigned_trimester = student.trimester if student.trimester and student.trimester > 0 else trimester
                next_label = self._trimester_label(assigned_year, assigned_trimester)
                changed_fields = []
                if student.year != assigned_year:
                    student.year = assigned_year
                    changed_fields.append("year")
                if student.trimester != assigned_trimester:
                    student.trimester = assigned_trimester
                    changed_fields.append("trimester")
                if student.trimester_label != next_label:
                    student.trimester_label = next_label
                    changed_fields.append("trimester_label")
                if changed_fields:
                    total_updated += 1
                    if dry_run:
                        self.stdout.write(
                            f"[DRY-RUN] update student={student.user.username} programme="
                            f"{student.programme.code if student.programme else 'NONE'} "
                            f"year={assigned_year} trimester={assigned_trimester}"
                        )
                    else:
                        student.save(update_fields=changed_fields)
                        self.stdout.write(
                            f"Updated {student.user.username}: year={assigned_year}, trimester={assigned_trimester}"
                        )

        self.stdout.write(self.style.SUCCESS(f"Backfill complete. Updated students: {total_updated}"))

    def _create_demo_students(
        self,
        *,
        programmes,
        per_year: int,
        trimester: int,
        password: str,
        no_guardians: bool,
        dry_run: bool,
    ):
        self.stdout.write(self.style.MIGRATE_HEADING("Creating/updating demo students per year"))
        total_students = 0
        total_guardians = 0
        for programme in programmes:
            max_year = self._programme_max_year(programme)
            code_slug = (programme.code or "GEN").lower().replace("-", "_")

            for year in range(1, max_year + 1):
                for seq in range(1, per_year + 1):
                    username = f"demo_{code_slug}_y{year}_{seq}"
                    email = f"{username}@example.com"
                    display_name = f"Demo Student {programme.code} Year {year} #{seq}"

                    guardian_username = f"demo_guardian_{code_slug}_y{year}_{seq}"
                    guardian_email = f"{guardian_username}@example.com"
                    guardian_name = f"Demo Guardian {programme.code} Year {year} #{seq}"

                    if dry_run:
                        self.stdout.write(
                            f"[DRY-RUN] ensure student user={username}, programme={programme.code}, year={year}"
                        )
                        if not no_guardians:
                            self.stdout.write(f"[DRY-RUN] ensure guardian user={guardian_username} linked to {username}")
                        total_students += 1
                        if not no_guardians:
                            total_guardians += 1
                        continue

                    user, created = User.objects.get_or_create(
                        username=username,
                        defaults={
                            "email": email,
                            "display_name": display_name,
                            "role": User.Roles.STUDENT,
                            "is_staff": False,
                            "is_superuser": False,
                            "must_change_password": False,
                        },
                    )

                    user_updates = []
                    if user.role != User.Roles.STUDENT:
                        user.role = User.Roles.STUDENT
                        user_updates.append("role")
                    if user.email != email:
                        user.email = email
                        user_updates.append("email")
                    if user.display_name != display_name:
                        user.display_name = display_name
                        user_updates.append("display_name")
                    if user.must_change_password:
                        user.must_change_password = False
                        user_updates.append("must_change_password")
                    if user.is_staff:
                        user.is_staff = False
                        user_updates.append("is_staff")
                    if user.is_superuser:
                        user.is_superuser = False
                        user_updates.append("is_superuser")
                    user.set_password(password)
                    user_updates.append("password")
                    user.save(update_fields=list(set(user_updates)))

                    student_profile, profile_created = Student.objects.get_or_create(
                        user=user,
                        defaults={
                            "programme": programme,
                            "year": year,
                            "trimester": trimester,
                            "trimester_label": self._trimester_label(year, trimester),
                            "current_status": Student.Status.ACTIVE,
                        },
                    )

                    profile_updates = []
                    if student_profile.programme_id != programme.id:
                        student_profile.programme = programme
                        profile_updates.append("programme")
                    if student_profile.year != year:
                        student_profile.year = year
                        profile_updates.append("year")
                    if student_profile.trimester != trimester:
                        student_profile.trimester = trimester
                        profile_updates.append("trimester")
                    next_label = self._trimester_label(year, trimester)
                    if student_profile.trimester_label != next_label:
                        student_profile.trimester_label = next_label
                        profile_updates.append("trimester_label")
                    if student_profile.current_status != Student.Status.ACTIVE:
                        student_profile.current_status = Student.Status.ACTIVE
                        profile_updates.append("current_status")
                    if profile_updates:
                        student_profile.save(update_fields=profile_updates)

                    status_word = "Created" if created or profile_created else "Updated"
                    self.stdout.write(
                        f"{status_word} demo student {username} -> programme={programme.code}, year={year}"
                    )
                    total_students += 1

                    if no_guardians:
                        continue

                    guardian_user, guardian_created = User.objects.get_or_create(
                        username=guardian_username,
                        defaults={
                            "email": guardian_email,
                            "display_name": guardian_name,
                            "role": User.Roles.PARENT,
                            "is_staff": False,
                            "is_superuser": False,
                            "must_change_password": False,
                        },
                    )
                    guardian_user_updates = []
                    if guardian_user.role != User.Roles.PARENT:
                        guardian_user.role = User.Roles.PARENT
                        guardian_user_updates.append("role")
                    if guardian_user.email != guardian_email:
                        guardian_user.email = guardian_email
                        guardian_user_updates.append("email")
                    if guardian_user.display_name != guardian_name:
                        guardian_user.display_name = guardian_name
                        guardian_user_updates.append("display_name")
                    if guardian_user.must_change_password:
                        guardian_user.must_change_password = False
                        guardian_user_updates.append("must_change_password")
                    if guardian_user.is_staff:
                        guardian_user.is_staff = False
                        guardian_user_updates.append("is_staff")
                    if guardian_user.is_superuser:
                        guardian_user.is_superuser = False
                        guardian_user_updates.append("is_superuser")
                    guardian_user.set_password(password)
                    guardian_user_updates.append("password")
                    guardian_user.save(update_fields=list(set(guardian_user_updates)))

                    guardian_profile, guardian_profile_created = Guardian.objects.get_or_create(user=guardian_user)
                    ParentStudentLink.objects.get_or_create(
                        parent=guardian_profile,
                        student=student_profile,
                        defaults={"relationship": "Guardian"},
                    )
                    guardian_state = "Created" if guardian_created or guardian_profile_created else "Updated"
                    self.stdout.write(
                        f"{guardian_state} demo guardian {guardian_username} linked to {username}"
                    )
                    total_guardians += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Demo generation complete. Student records touched={total_students}, "
                f"guardian records touched={total_guardians}"
            )
        )
