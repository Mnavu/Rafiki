from __future__ import annotations

from collections import defaultdict
from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from finance.models import FinanceStatus, Payment
from learning.models import (
    Assignment,
    CurriculumUnit,
    LecturerAssignment,
    Programme,
    Registration,
    TermOffering,
    Timetable,
)
from users.models import Lecturer, Student


class Command(BaseCommand):
    help = "Populate UAT data for timetable, curriculum offerings, registrations, and finance records."

    def add_arguments(self, parser):
        parser.add_argument(
            "--weeks",
            type=int,
            default=4,
            help="Number of upcoming weeks to populate in timetable data.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print actions without saving changes.",
        )

    def handle(self, *args, **options):
        weeks = max(1, options["weeks"])
        dry_run = options["dry_run"]

        if dry_run:
            self._run(weeks=weeks, dry_run=True)
            self.stdout.write(self.style.WARNING("Dry run completed. No records were changed."))
            return

        with transaction.atomic():
            self._run(weeks=weeks, dry_run=False)
        self.stdout.write(self.style.SUCCESS("UAT seed completed."))

    def _run(self, *, weeks: int, dry_run: bool):
        lecturers = list(Lecturer.objects.select_related("user").all().order_by("user__id"))
        programmes = list(Programme.objects.all().order_by("code"))
        students = list(Student.objects.select_related("user", "programme").all().order_by("user__id"))

        if not programmes:
            self.stdout.write(self.style.WARNING("No programmes found. Run seed_demo first."))
            return
        if not lecturers:
            self.stdout.write(
                self.style.WARNING("No lecturer profiles found. Lecturer assignment and timetable seeding skipped."),
            )

        now = timezone.now()
        monday = now - timedelta(days=(now.weekday()))
        start_anchor = monday.replace(hour=9, minute=0, second=0, microsecond=0)

        counts = defaultdict(int)

        for programme in programmes:
            units = list(
                CurriculumUnit.objects.filter(programme=programme).order_by("trimester_hint", "code")
            )
            if not units:
                continue

            for unit in units:
                trimester = unit.trimester_hint or 1
                academic_year = 1
                if not dry_run:
                    TermOffering.objects.update_or_create(
                        programme=programme,
                        unit=unit,
                        academic_year=academic_year,
                        trimester=trimester,
                        defaults={"offered": True, "capacity": 80},
                    )
                counts["offerings"] += 1

                if lecturers:
                    lecturer = lecturers[(counts["offerings"] - 1) % len(lecturers)]
                    if not dry_run:
                        LecturerAssignment.objects.update_or_create(
                            lecturer=lecturer,
                            unit=unit,
                            academic_year=academic_year,
                            trimester=trimester,
                        )
                    counts["lecturer_assignments"] += 1

                due_at = now + timedelta(days=(trimester * 7))
                if not dry_run:
                    Assignment.objects.update_or_create(
                        unit=unit,
                        title=f"{unit.code} Week assignment",
                        defaults={
                            "lecturer": lecturers[(counts["offerings"] - 1) % len(lecturers)] if lecturers else None,
                            "description": f"Complete the weekly learning task for {unit.title}.",
                            "due_at": due_at,
                        },
                    )
                counts["assignments"] += 1

            timetable_units = units[: min(6, len(units))]
            for week_index in range(weeks):
                for unit_index, unit in enumerate(timetable_units):
                    lecturer = lecturers[(unit_index + week_index) % len(lecturers)] if lecturers else None
                    class_start = start_anchor + timedelta(days=week_index * 7 + unit_index, hours=unit_index)
                    class_end = class_start + timedelta(hours=2)
                    room = f"Room {101 + unit_index}"
                    if not dry_run:
                        Timetable.objects.update_or_create(
                            programme=programme,
                            unit=unit,
                            lecturer=lecturer,
                            start_datetime=class_start,
                            defaults={
                                "end_datetime": class_end,
                                "room": room,
                            },
                        )
                    counts["timetable"] += 1

        for index, student in enumerate(students):
            if not student.programme_id:
                continue
            programme_units = list(
                CurriculumUnit.objects.filter(programme=student.programme).order_by("trimester_hint", "code")
            )
            if not programme_units:
                continue

            target_trimester = student.trimester if student.trimester and student.trimester > 0 else 1
            target_units = [unit for unit in programme_units if (unit.trimester_hint or 1) == target_trimester]
            if len(target_units) < 3:
                target_units = programme_units[:3]
            else:
                target_units = target_units[:3]

            for unit in target_units:
                if not dry_run:
                    Registration.objects.update_or_create(
                        student=student,
                        unit=unit,
                        academic_year=student.year,
                        trimester=target_trimester,
                        defaults={
                            "status": Registration.Status.APPROVED,
                            "approved_at": now,
                        },
                    )
                counts["registrations"] += 1

            total_due = Decimal("120000.00")
            paid_ratio = Decimal("0.75") if index % 2 == 0 else Decimal("0.55")
            total_paid = (total_due * paid_ratio).quantize(Decimal("0.01"))
            clearance_status = (
                FinanceStatus.Clearance.CLEARED_FOR_REGISTRATION
                if paid_ratio >= Decimal("0.60")
                else FinanceStatus.Clearance.BLOCKED
            )
            status = (
                FinanceStatus.Status.PAID
                if total_paid >= total_due
                else FinanceStatus.Status.PARTIAL
                if total_paid > Decimal("0.00")
                else FinanceStatus.Status.PENDING
            )

            if not dry_run:
                FinanceStatus.objects.update_or_create(
                    student=student,
                    academic_year=student.year,
                    trimester=target_trimester,
                    defaults={
                        "total_due": total_due,
                        "total_paid": total_paid,
                        "status": status,
                        "clearance_status": clearance_status,
                    },
                )
            counts["finance_statuses"] += 1

            first_payment = (total_paid * Decimal("0.6")).quantize(Decimal("0.01"))
            second_payment = (total_paid - first_payment).quantize(Decimal("0.01"))
            payment_chunks = [first_payment, second_payment]
            for chunk_index, chunk in enumerate(payment_chunks):
                if chunk <= Decimal("0.00"):
                    continue
                if not dry_run:
                    Payment.objects.update_or_create(
                        student=student,
                        academic_year=student.year,
                        trimester=target_trimester,
                        ref=f"SEED-{student.user_id}-{target_trimester}-{chunk_index + 1}",
                        defaults={
                            "amount": chunk,
                            "method": "seeded-mobile-money",
                            "paid_at": now - timedelta(days=chunk_index + 1),
                        },
                    )
                counts["payments"] += 1

            next_status = (
                Student.Status.FINANCE_OK
                if paid_ratio >= Decimal("0.60")
                else Student.Status.BLOCKED
            )
            if not dry_run and student.current_status != next_status:
                student.current_status = next_status
                student.save(update_fields=["current_status"])
                counts["student_status_updates"] += 1

        self.stdout.write(self.style.MIGRATE_HEADING("UAT seed summary"))
        for key in sorted(counts.keys()):
            self.stdout.write(f"{key}: {counts[key]}")
