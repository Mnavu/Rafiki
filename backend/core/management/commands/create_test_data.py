from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from learning.models import Programme, CurriculumUnit
from learning.session_models import CourseSchedule, CourseSession
from core.models import Department
from users.models import Student, Lecturer, HOD

User = get_user_model()

TEST_USERS = [
    # Students
    {
        "username": "student1",
        "password": "testing123",
        "email": "student1@test.com",
        "role": "student",
        "display_name": "Test Student One",
    },
    {
        "username": "student2", 
        "password": "testing123",
        "email": "student2@test.com",
        "role": "student",
        "display_name": "Test Student Two",
    },
    {
        "username": "student3",
        "password": "testing123",
        "email": "student3@test.com",
        "role": "student",
        "display_name": "Test Student Three",
    },
    
    # Lecturers
    {
        "username": "lecturer1",
        "password": "testing123", 
        "email": "lecturer1@test.com",
        "role": "lecturer",
        "display_name": "Dr. Test Lecturer",
    },
    {
        "username": "lecturer2",
        "password": "testing123", 
        "email": "lecturer2@test.com",
        "role": "lecturer",
        "display_name": "Dr. Math Lecturer",
    },
    {
        "username": "lecturer3",
        "password": "testing123", 
        "email": "lecturer3@test.com",
        "role": "lecturer",
        "display_name": "Dr. Programming Lecturer",
    },
    
    # Department Heads
    {
        "username": "cs_hod",
        "password": "testing123",
        "email": "cs_hod@test.com", 
        "role": "hod",
        "display_name": "Prof. CS Department Head",
    },
    {
        "username": "math_hod",
        "password": "testing123",
        "email": "math_hod@test.com", 
        "role": "hod",
        "display_name": "Prof. Math Department Head",
    },
    
    # Administrators
    {
        "username": "admin1",
        "password": "testing123",
        "email": "admin@test.com",
        "role": "admin",
        "display_name": "System Administrator",
    }
]

DEPARTMENTS = [
    {
        "name": "Computer Science",
        "code": "CS",
    },
    {
        "name": "Mathematics",
        "code": "MATH",
    }
]

PROGRAMMES = [
    # Computer Science Programmes
    {
        "name": "Introduction to Programming",
        "code": "CS101",
        "department": "CS",
        "award_level": "BSc",
        "duration_years": 3,
        "trimesters_per_year": 2
    },
    {
        "name": "Data Structures",
        "code": "CS201",
        "department": "CS",
        "award_level": "BSc",
        "duration_years": 3,
        "trimesters_per_year": 2
    },
    {
        "name": "Web Development",
        "code": "CS301",
        "department": "CS",
        "award_level": "BSc",
        "duration_years": 3,
        "trimesters_per_year": 2
    },
    
    # Mathematics Programmes
    {
        "name": "Basic Mathematics",
        "code": "MATH101",
        "department": "MATH",
        "award_level": "BSc",
        "duration_years": 3,
        "trimesters_per_year": 2
    },
    {
        "name": "Calculus I",
        "code": "MATH201",
        "department": "MATH",
        "award_level": "BSc",
        "duration_years": 3,
        "trimesters_per_year": 2
    },
    {
        "name": "Linear Algebra",
        "code": "MATH301",
        "department": "MATH",
        "award_level": "BSc",
        "duration_years": 3,
        "trimesters_per_year": 2
    }
]

class Command(BaseCommand):
    help = 'Creates test data for development and testing'

    def handle(self, *args, **kwargs):
        self.stdout.write('Creating test data...')
        
        # Create departments
        departments = {}
        for dept in DEPARTMENTS:
            department, created = Department.objects.get_or_create(
                code=dept["code"],
                defaults={
                    "name": dept["name"],
                }
            )
            departments[dept["code"]] = department
            if created:
                self.stdout.write(f'Created department: {department.name}')

        # Create test users
        users = {}
        for user_data in TEST_USERS:
            
            user, created = User.objects.get_or_create(
                username=user_data["username"],
                defaults=user_data
            )
            
            if created:
                user.set_password(user_data["password"])
                user.save()
                self.stdout.write(f'Created user: {user.username} ({user.role})')
            
            users[user.username] = user

            if user.role == 'student':
                Student.objects.get_or_create(user=user, defaults={'year': 1, 'trimester': 1, 'trimester_label': 'T1', 'cohort_year': 2024})
            elif user.role == 'lecturer':
                Lecturer.objects.get_or_create(user=user)
            elif user.role == 'hod':
                hod_profile, hod_created = HOD.objects.get_or_create(user=user)
                if user.username == 'cs_hod':
                    cs_dept = departments["CS"]
                    cs_dept.head_of_department = hod_profile
                    cs_dept.save()
                    self.stdout.write(f'Assigned {user.username} as HOD of {cs_dept.name}')
                elif user.username == 'math_hod':
                    math_dept = departments["MATH"]
                    math_dept.head_of_department = hod_profile
                    math_dept.save()
                    self.stdout.write(f'Assigned {user.username} as HOD of {math_dept.name}')

        # Create programmes
        for programme_data in PROGRAMMES:
            dept_code = programme_data.pop("department")
            programme, created = Programme.objects.get_or_create(
                code=programme_data["code"],
                defaults={
                    **programme_data,
                    "department": departments[dept_code],
                }
            )
            
            if created:
                self.stdout.write(f'Created programme: {programme.name}')
                
                # Create some units
                CurriculumUnit.objects.get_or_create(
                    programme=programme,
                    code=f"{programme.code}-U1",
                    title=f"Unit 1: Introduction to {programme.name}",
                    credit_hours=3,
                )
                
                # Create a schedule
                schedule = CourseSchedule.objects.create(
                    programme=programme,
                    term="2024-T1",
                    day_of_week=1,  # Monday
                    start_time="09:00",
                    duration_minutes=90
                )
                
                # Create some sessions
                for week in range(1, 5):
                    CourseSession.objects.create(
                        schedule=schedule,
                        date=timezone.now().date() + timezone.timedelta(days=7 * week),
                        status="scheduled"
                    )

        self.stdout.write(self.style.SUCCESS('''
Test data created successfully!

You can now log in with the following credentials:

Students:
- Username: student1, Password: testing123
- Username: student2, Password: testing123

Lecturer:
- Username: lecturer1, Password: testing123

Head of Department:
- Username: cs_hod, Password: testing123

Admin:
- Username: admin1, Password: testing123

All users have the password: testing123
'''))