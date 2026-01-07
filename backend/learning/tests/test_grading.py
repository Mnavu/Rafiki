from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from decimal import Decimal

from users.models import User, Student, Lecturer
from learning.models import Programme, CurriculumUnit, Assignment, Submission
from learning.progress_models import CompletionRecord
from core.models import Department

class GradingWorkflowTest(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create users
        self.lecturer_user = User.objects.create_user("lecturer_test", "lecturer@test.com", "password", role=User.Roles.LECTURER)
        self.student_user = User.objects.create_user("student_test", "student@test.com", "password", role=User.Roles.STUDENT)

        # Create department and programme
        self.department = Department.objects.create(name="Test Department")
        self.programme = Programme.objects.create(name="Test Programme", code="TP", department=self.department, duration_years=1, trimesters_per_year=1)

        # Create profiles
        self.lecturer_profile = Lecturer.objects.create(user=self.lecturer_user, department=self.department)
        self.student_profile = Student.objects.create(user=self.student_user, programme=self.programme, year=1, trimester=1, trimester_label="T1", cohort_year=2024)

        # Create unit and assignment
        self.unit = CurriculumUnit.objects.create(programme=self.programme, code="TP101", title="Test Unit", credit_hours=3)
        self.assignment = Assignment.objects.create(unit=self.unit, lecturer=self.lecturer_profile, title="Test Assignment")

        # Create a submission
        self.submission = Submission.objects.create(assignment=self.assignment, student=self.student_profile, content_url="http://example.com")

    def test_lecturer_can_grade_submission(self):
        self.client.force_authenticate(user=self.lecturer_user)

        grading_data = {
            "grade": "85.50"
        }

        url = reverse("lecturer-grading-detail", kwargs={'pk': self.submission.id})
        response = self.client.patch(url, grading_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Check submission grade
        self.submission.refresh_from_db()
        self.assertEqual(self.submission.grade, Decimal("85.50"))

        # Check completion record
        completion_record = CompletionRecord.objects.get(
            student=self.student_profile,
            assignment=self.assignment
        )
        self.assertEqual(completion_record.score, 85.50)
        self.assertEqual(completion_record.completion_type, 'teacher_verified')
        self.assertEqual(completion_record.verified_by, self.lecturer_user)
