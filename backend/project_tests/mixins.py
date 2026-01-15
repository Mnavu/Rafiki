from django.contrib.auth import get_user_model

from users.models import ParentStudentLink, Student, Guardian, Lecturer
from learning.models import Programme, CurriculumUnit, Registration, Assignment, Submission
from learning.progress_models import CompletionRecord
from finance.models import Payment
from communications.models import Thread, Message


class ParentStudentFixtureMixin:
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        User = get_user_model()
        cls.parent_user = User.objects.create_user(
            username="parent_test",
            password="parentpass",
            role=User.Roles.PARENT,
            email="parent@example.com",
        )
        cls.parent = Guardian.objects.create(user=cls.parent_user)

        cls.student_user = User.objects.create_user(
            username="student_test",
            password="studentpass",
            role=User.Roles.STUDENT,
            email="student@example.com",
        )
        cls.student = Student.objects.create(user=cls.student_user, year=1, trimester=1, trimester_label="T1", cohort_year=2024)
        
        cls.teacher_user = User.objects.create_user(
            username="teacher_test",
            password="teacherpass",
            role=User.Roles.LECTURER,
            email="teacher@example.com",
        )
        cls.teacher = Lecturer.objects.create(user=cls.teacher_user)

        cls.other_parent_user = User.objects.create_user(
            username="other_parent",
            password="parentpass",
            role=User.Roles.PARENT,
            email="other_parent@example.com",
        )
        cls.other_parent = Guardian.objects.create(user=cls.other_parent_user)

        cls.unlinked_student_user = User.objects.create_user(
            username="student_unlinked",
            password="studentpass",
            role=User.Roles.STUDENT,
            email="student_unlinked@example.com",
        )
        cls.unlinked_student = Student.objects.create(user=cls.unlinked_student_user, year=1, trimester=1, trimester_label="T1", cohort_year=2024)


        ParentStudentLink.objects.create(
            parent=cls.parent,
            student=cls.student,
            relationship="Mother",
        )

        cls.programme = Programme.objects.create(
            name="Demo Programme",
            code="DEMO101",
            award_level="Bachelor",
            duration_years=3,
            trimesters_per_year=2
        )
        cls.unit_one = CurriculumUnit.objects.create(
            programme=cls.programme,
            code="UNIT1",
            title="Unit One",
            credit_hours=3
        )
        cls.unit_two = CurriculumUnit.objects.create(
            programme=cls.programme,
            code="UNIT2",
            title="Unit Two",
            credit_hours=3
        )

        cls.registration = Registration.objects.create(
            student=cls.student,
            unit=cls.unit_one,
            academic_year=2024,
            trimester=1,
            status='approved'
        )
        cls.registration_two = Registration.objects.create(
            student=cls.student,
            unit=cls.unit_two,
            academic_year=2024,
            trimester=1,
            status='approved'
        )

        assignment1 = Assignment.objects.create(unit=cls.unit_one, title="Unit 1 Assignment")
        Submission.objects.create(assignment=assignment1, student=cls.student, grade=90)

        assignment2 = Assignment.objects.create(unit=cls.unit_two, title="Unit 2 Assignment")
        Submission.objects.create(assignment=assignment2, student=cls.student, grade=70)


        Payment.objects.create(
            student=cls.student,
            academic_year=2024,
            trimester=1,
            amount=250,
            method="Card",
        )

        cls.thread = Thread.objects.create(
            subject="Progress check",
            student=cls.student_user,
            teacher=cls.teacher_user,
            parent=cls.parent_user
        )
        cls.parent_message = Message.objects.create(
            thread=cls.thread,
            author=cls.parent_user,
            body="How is my child doing?",
            sender_role=Message.SenderRoles.PARENT,
        )
        cls.teacher_message = Message.objects.create(
            thread=cls.thread,
            author=cls.teacher_user,
            body="Doing well!",
            sender_role=Message.SenderRoles.TEACHER,
        )

