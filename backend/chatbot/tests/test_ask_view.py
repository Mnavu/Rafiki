from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from learning.models import LecturerAssignment, Programme, CurriculumUnit, Registration, Timetable
from users.models import Lecturer, Student

User = get_user_model()


class ChatbotAskViewTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.student_user = User.objects.create_user(
            username="chat_student",
            password="password123",
            role=User.Roles.STUDENT,
            display_name="Aisha Student",
        )
        self.student_profile = Student.objects.create(
            user=self.student_user,
            year=1,
            trimester=1,
            trimester_label="Year 1 Trimester 1",
        )
        self.client.force_authenticate(self.student_user)

        self.lecturer_user = User.objects.create_user(
            username="chat_lecturer",
            password="password123",
            role=User.Roles.LECTURER,
            display_name="Peter Lecturer",
        )
        self.lecturer_profile = Lecturer.objects.create(user=self.lecturer_user)

        self.programme = Programme.objects.create(
            code="DTM-CHAT",
            name="Diploma in Travel and Tourism Management",
            award_level="Diploma",
            duration_years=2,
            trimesters_per_year=3,
        )
        self.student_profile.programme = self.programme
        self.student_profile.save(update_fields=["programme"])

        self.unit = CurriculumUnit.objects.create(
            programme=self.programme,
            code="DTM101",
            title="Communication Skills",
            credit_hours=3,
            trimester_hint=1,
        )
        LecturerAssignment.objects.create(
            lecturer=self.lecturer_profile,
            unit=self.unit,
            academic_year=2026,
            trimester=1,
        )
        Registration.objects.create(
            student=self.student_profile,
            unit=self.unit,
            academic_year=2026,
            trimester=1,
            status=Registration.Status.APPROVED,
        )
        start_at = timezone.now() + timedelta(hours=4)
        end_at = start_at + timedelta(hours=2)
        Timetable.objects.create(
            programme=self.programme,
            unit=self.unit,
            lecturer=self.lecturer_profile,
            room="Room 4",
            start_datetime=start_at,
            end_datetime=end_at,
        )

    def test_exact_next_class_response_includes_lecturer(self):
        response = self.client.post(
            "/api/chatbot/ask/",
            {"query": "What is my exact next class and who is teaching it?"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Your next class is DTM101", response.data["text"])
        self.assertIn("Peter Lecturer", response.data["text"])
        self.assertNotIn("Your next classes:", response.data["text"])

    def test_irrelevant_question_is_rejected(self):
        response = self.client.post(
            "/api/chatbot/ask/",
            {"query": "What is the capital of France?"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("not relevant to school work", response.data["text"])

    def test_study_materials_question_points_student_to_right_sections(self):
        response = self.client.post(
            "/api/chatbot/ask/",
            {"query": "Where do I find study materials for my classes?"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Class communities", response.data["text"])
        self.assertIn("Assignments", response.data["text"])
        self.assertIn("Message center", response.data["text"])

    def test_app_navigation_question_uses_student_screen_labels(self):
        response = self.client.post(
            "/api/chatbot/ask/",
            {"query": "How do I use this app to find my fees and groups?"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Finance and rewards", response.data["text"])
        self.assertIn("Class communities", response.data["text"])
