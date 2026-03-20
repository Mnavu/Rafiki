from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from users.models import User


class ProfileUpdateTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="student_alpha",
            email="alpha@example.com",
            password="Password@2026",
            role=User.Roles.STUDENT,
            display_name="Student Alpha",
        )
        self.other_user = User.objects.create_user(
            username="student_bravo",
            email="bravo@example.com",
            password="Password@2026",
            role=User.Roles.STUDENT,
            display_name="Student Bravo",
        )
        self.url = reverse("users-me")

    def test_user_can_update_username_and_display_name(self):
        self.client.force_authenticate(user=self.user)
        payload = {
            "username": "student_charlie",
            "display_name": "Charlie Student",
        }

        response = self.client.patch(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "student_charlie")
        self.assertEqual(self.user.display_name, "Charlie Student")

    def test_user_cannot_take_existing_username(self):
        self.client.force_authenticate(user=self.user)
        payload = {"username": self.other_user.username}

        response = self.client.patch(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.data)

