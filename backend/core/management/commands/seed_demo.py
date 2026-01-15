from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from learning.models import Programme, CurriculumUnit
from repository.models import Resource
from users.models import Student, Guardian, Lecturer, HOD, Admin, RecordsOfficer, FinanceOfficer

DEMO_USERS = [
    {
        "username": "student1",
        "password": "Student@2025",
        "role": "student",
        "email": "student1@example.com",
        "display_name": "Aisha Student",
    },
    {
        "username": "parent1",
        "password": "Parent@2025",
        "role": "parent",
        "email": "parent1@example.com",
        "display_name": "Grace Parent",
    },
    {
        "username": "lecturer1",
        "password": "Lecturer@2025",
        "role": "lecturer",
        "email": "lecturer1@example.com",
        "display_name": "Peter Lecturer",
    },
    {
        "username": "hod1",
        "password": "HOD@2025",
        "role": "hod",
        "email": "hod1@example.com",
        "display_name": "Mary HoD",
    },
    {
        "username": "finance1",
        "password": "Finance@2025",
        "role": "finance",
        "email": "finance1@example.com",
        "display_name": "James Finance",
    },
    {
        "username": "records1",
        "password": "Records@2025",
        "role": "records",
        "email": "records1@example.com",
        "display_name": "Linda Records",
    },
    {
        "username": "admin1",
        "password": "Admin@2025",
        "role": "admin",
        "email": "admin1@example.com",
        "display_name": "Allan Admin",
    },
    {
        "username": "superadmin1",
        "password": "SuperAdmin@2025",
        "role": "superadmin",
        "email": "superadmin1@example.com",
        "display_name": "Sophia SuperAdmin",
    },
]


class Command(BaseCommand):
    help = "Seed demo users, sample programme/unit, and a library resource"

    def handle(self, *args, **options):
        User = get_user_model()

        self.stdout.write(self.style.MIGRATE_HEADING("Seeding demo users"))
        user_lookup = {}
        for payload in DEMO_USERS:
            username = payload["username"]
            role = payload["role"]
            defaults = {
                "role": role,
                "email": payload.get("email", ""),
                "display_name": payload.get("display_name", ""),
                "is_staff": role not in ['student', 'parent'],
                "is_superuser": role == 'superadmin',
            }
            user, created = User.objects.get_or_create(username=username, defaults=defaults)
            updated_fields = set()

            for field, value in defaults.items():
                if getattr(user, field) != value:
                    setattr(user, field, value)
                    updated_fields.add(field)

            user.set_password(payload["password"])
            updated_fields.add("password")
            user.must_change_password = False
            updated_fields.add("must_change_password")
            if updated_fields:
                user.save(update_fields=list(updated_fields))

            action = "Created" if created else "Updated"
            self.stdout.write(
                self.style.SUCCESS(
                    f"{action} {username} (role: {role}) with password {payload['password']}"
                )
            )
            user_lookup[username] = user

            # Create role-specific profiles
            if role == 'student':
                Student.objects.get_or_create(user=user, defaults={'student_id': username, 'year': 1, 'trimester': 1, 'trimester_label': 'T1', 'cohort_year': 2024})
            elif role == 'parent':
                Guardian.objects.get_or_create(user=user)
            elif role == 'lecturer':
                Lecturer.objects.get_or_create(user=user)
            elif role == 'hod':
                HOD.objects.get_or_create(user=user)
            elif role == 'admin':
                Admin.objects.get_or_create(user=user)
            elif role == 'records':
                RecordsOfficer.objects.get_or_create(user=user)
            elif role == 'finance':
                FinanceOfficer.objects.get_or_create(user=user)


        self.stdout.write(self.style.MIGRATE_HEADING("Seeding sample programme, unit, and resource"))

        programme, _ = Programme.objects.get_or_create(
            code="TTM101",
            defaults={
                "name": "Fundamentals of Tourism",
                "award_level": "Certificate",
                "duration_years": 1,
                "trimesters_per_year": 2,
            },
        )

        CurriculumUnit.objects.update_or_create(
            programme=programme,
            code="TTM101-U1",
            title="Week 1: Tourism Foundations",
            credit_hours=3,
            defaults={"description": "Overview of tourism concepts, terminology, and industry sectors."},
        )

        Resource.objects.update_or_create(
            title="Tourism Basics Handbook",
            defaults={
                "kind": Resource.Kind.PDF,
                "description": "A primer covering tourism definitions, geography, and customer care.",
                "url": "https://example.com/tourism-basics.pdf",
            },
        )

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))
