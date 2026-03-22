from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from learning.models import Assignment, CurriculumUnit, Programme, Registration, Submission
from users.models import Student

User = get_user_model()


class StudentSubmissionApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student_user = User.objects.create_user(
            username="submit_student",
            password="password123",
            role=User.Roles.STUDENT,
        )
        self.student = Student.objects.create(
            user=self.student_user,
            year=1,
            trimester=1,
            trimester_label="Year 1 Trimester 1",
            current_status=Student.Status.ACTIVE,
        )
        self.programme = Programme.objects.create(
            code="SUBMIT",
            name="Submission Test Programme",
            award_level="Diploma",
            duration_years=2,
            trimesters_per_year=3,
        )
        self.student.programme = self.programme
        self.student.save(update_fields=["programme"])
        self.unit = CurriculumUnit.objects.create(
            programme=self.programme,
            code="SUB101",
            title="Submission Skills",
            credit_hours=3,
            trimester_hint=1,
        )
        self.assignment = Assignment.objects.create(
            unit=self.unit,
            title="Reflection task",
            description="Write a short reflection.",
        )
        Registration.objects.create(
            student=self.student,
            unit=self.unit,
            academic_year=2026,
            trimester=1,
            status=Registration.Status.APPROVED,
        )
        self.client.force_authenticate(self.student_user)

    def test_student_can_create_text_submission(self):
        response = self.client.post(
            "/api/learning/submissions/",
            {
                "assignment": self.assignment.id,
                "text_response": "This is my short written answer.",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        submission = Submission.objects.get(assignment=self.assignment, student=self.student)
        self.assertEqual(submission.text_response, "This is my short written answer.")

    def test_second_submit_updates_existing_submission(self):
        Submission.objects.create(
            assignment=self.assignment,
            student=self.student,
            text_response="Old answer",
        )
        response = self.client.post(
            "/api/learning/submissions/",
            {
                "assignment": self.assignment.id,
                "text_response": "Updated answer",
            },
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Submission.objects.filter(assignment=self.assignment, student=self.student).count(),
            1,
        )
        submission = Submission.objects.get(assignment=self.assignment, student=self.student)
        self.assertEqual(submission.text_response, "Updated answer")

