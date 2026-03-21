from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from learning.models import Programme, CurriculumUnit, TermOffering
from repository.models import LibraryAsset
from users.models import Student, Guardian, Lecturer, HOD, Admin, RecordsOfficer, FinanceOfficer, ParentStudentLink
from core.models import Department

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
                Student.objects.get_or_create(
                    user=user,
                    defaults={
                        'year': 1,
                        'trimester': 1,
                        'trimester_label': 'Year 1, Trimester 1',
                    },
                )
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
        )

        LibraryAsset.objects.update_or_create(
            title="Tourism Basics Handbook",
            defaults={
                "type": LibraryAsset.AssetType.PDF,
                "url": "https://example.com/tourism-basics.pdf",
            },
        )

        self.stdout.write(self.style.MIGRATE_HEADING("Seeding Tourism & Travel Programme"))

        # Create Department
        tourism_dept, _ = Department.objects.get_or_create(
            code="TT",
            defaults={"name": "Tourism and Travel"},
        )

        # Create Programme
        tourism_programme, _ = Programme.objects.get_or_create(
            code="CTT01",
            defaults={
                "name": "Certificate in Tourism and Travel",
                "award_level": "Certificate",
                "duration_years": 2,
                "trimesters_per_year": 3,
                "department": tourism_dept,
            },
        )

        lecturer_profile = Lecturer.objects.filter(user=user_lookup.get("lecturer1")).first()
        if lecturer_profile and lecturer_profile.department_id != tourism_dept.id:
            lecturer_profile.department = tourism_dept
            lecturer_profile.save(update_fields=["department"])

        hod_profile = HOD.objects.filter(user=user_lookup.get("hod1")).first()
        if hod_profile and hod_profile.department_id != tourism_dept.id:
            hod_profile.department = tourism_dept
            hod_profile.save(update_fields=["department"])
        if hod_profile and tourism_dept.head_of_department_id != hod_profile.user_id:
            tourism_dept.head_of_department = hod_profile
            tourism_dept.save(update_fields=["head_of_department"])

        student_profile = Student.objects.filter(user=user_lookup.get("student1")).first()
        if student_profile:
            updated_fields = []
            if student_profile.programme_id != tourism_programme.id:
                student_profile.programme = tourism_programme
                updated_fields.append("programme")
            if student_profile.year != 1:
                student_profile.year = 1
                updated_fields.append("year")
            if student_profile.trimester != 1:
                student_profile.trimester = 1
                updated_fields.append("trimester")
            if student_profile.trimester_label != "Year 1, Trimester 1":
                student_profile.trimester_label = "Year 1, Trimester 1"
                updated_fields.append("trimester_label")
            if updated_fields:
                student_profile.save(update_fields=updated_fields)

        parent_profile = Guardian.objects.filter(user=user_lookup.get("parent1")).first()
        if student_profile and parent_profile:
            ParentStudentLink.objects.get_or_create(
                parent=parent_profile,
                student=student_profile,
                defaults={"relationship": "Guardian"},
            )

        tourism_units = {
            1: {
                1: [
                    {"code": "TT-111", "title": "Introduction to the Global Travel & Tourism Industry", "credits": 3},
                    {"code": "TT-112", "title": "Travel Products and Services", "credits": 3},
                    {"code": "TT-113", "title": "Customer Service", "credits": 3},
                    {"code": "TT-114", "title": "Communication Skills", "credits": 3},
                ],
                2: [
                    {"code": "TT-121", "title": "Destination Awareness and Management", "credits": 3},
                    {"code": "TT-122", "title": "Marketing and Sales in the Travel Industry", "credits": 3},
                    {"code": "TT-123", "title": "Tour Operations & Digital Distribution Channels", "credits": 3},
                    {"code": "TT-124", "title": "Hospitality Management", "credits": 3},
                ],
                3: [
                    {"code": "TT-131", "title": "Tourism Technology Systems and Booking Platforms", "credits": 3},
                    {"code": "TT-132", "title": "Travel Regulations and Safety", "credits": 3},
                    {"code": "TT-133", "title": "The Business of Tourism", "credits": 3},
                    {"code": "TT-134", "title": "Introduction to Event Management", "credits": 3},
                ],
            },
            2: {
                1: [
                    {"code": "TT-211", "title": "Advanced Tour Operations", "credits": 3},
                    {"code": "TT-212", "title": "Sustainable Tourism", "credits": 3},
                    {"code": "TT-213", "title": "Financial Management in Tourism", "credits": 3},
                    {"code": "TT-214", "title": "Human Resource Management in Tourism", "credits": 3},
                ],
                2: [
                    {"code": "TT-221", "title": "Ecotourism and Protected Area Management", "credits": 3},
                    {"code": "TT-222", "title": "Niche Tourism", "credits": 3},
                    {"code": "TT-223", "title": "Crisis Management in Tourism", "credits": 3},
                    {"code": "TT-224", "title": "Research Methods in Tourism", "credits": 3},
                ],
                3: [
                    {"code": "TT-231", "title": "Internship/Practicum", "credits": 6},
                    {"code": "TT-232", "title": "Final Project", "credits": 6},
                    {"code": "TT-233", "title": "Airline and Airport Operations", "credits": 3},
                    {"code": "TT-234", "title": "Entrepreneurship in Tourism", "credits": 3},
                ],
            },
        }

        for year, trimesters in tourism_units.items():
            for trimester, units in trimesters.items():
                for unit_data in units:
                    unit, _ = CurriculumUnit.objects.update_or_create(
                        programme=tourism_programme,
                        code=unit_data["code"],
                        defaults={
                            "title": unit_data["title"],
                            "credit_hours": unit_data["credits"],
                            "trimester_hint": trimester,
                        },
                    )
                    TermOffering.objects.update_or_create(
                        programme=tourism_programme,
                        unit=unit,
                        academic_year=year,
                        trimester=trimester,
                        defaults={"offered": True},
                    )

        self.stdout.write(self.style.SUCCESS("Demo data seeded successfully."))
