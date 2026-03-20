from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from users.models import User


class AdminUserCreationTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("users-admin-create")
        self.admin = User.objects.create_user(
            username="admin_alpha",
            password="Password@2026",
            role=User.Roles.ADMIN,
            display_name="Admin Alpha",
        )
        self.superadmin = User.objects.create_user(
            username="superadmin_alpha",
            password="Password@2026",
            role=User.Roles.SUPERADMIN,
            display_name="Super Admin Alpha",
            is_staff=True,
            is_superuser=True,
        )

    def test_admin_can_create_lecturer_account(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "username": "lecturer_new",
            "password": "Password@2026",
            "role": User.Roles.LECTURER,
            "display_name": "Lecturer New",
            "email": "lecturer@example.com",
        }

        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        created = User.objects.get(username="lecturer_new")
        self.assertEqual(created.role, User.Roles.LECTURER)
        self.assertTrue(hasattr(created, "lecturer_profile"))

    def test_admin_cannot_create_superadmin_account(self):
        self.client.force_authenticate(user=self.admin)
        payload = {
            "username": "superadmin_new",
            "password": "Password@2026",
            "role": User.Roles.SUPERADMIN,
            "display_name": "Super Admin New",
        }

        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)

    def test_superadmin_can_create_superadmin_account(self):
        self.client.force_authenticate(user=self.superadmin)
        payload = {
            "username": "superadmin_new",
            "password": "Password@2026",
            "role": User.Roles.SUPERADMIN,
            "display_name": "Super Admin New",
        }

        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        created = User.objects.get(username="superadmin_new")
        self.assertEqual(created.role, User.Roles.SUPERADMIN)
        self.assertTrue(created.is_staff)
        self.assertTrue(created.is_superuser)
