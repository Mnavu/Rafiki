from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from users.models import User


class AdminPasswordResetTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.url = reverse("users-admin-reset-password")
        self.admin = User.objects.create_user(
            username="admin_reset",
            password="Password@2026",
            role=User.Roles.ADMIN,
            display_name="Admin Reset",
        )
        self.superadmin = User.objects.create_user(
            username="superadmin_reset",
            password="Password@2026",
            role=User.Roles.SUPERADMIN,
            display_name="Super Admin Reset",
            is_staff=True,
            is_superuser=True,
        )
        self.lecturer = User.objects.create_user(
            username="lecturer_reset",
            password="OldPassword@2026",
            role=User.Roles.LECTURER,
            display_name="Lecturer Reset",
        )

    def test_admin_can_reset_regular_user_password(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            self.url,
            {
                "user_id": self.lecturer.id,
                "new_password": "TempPass@2026",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.lecturer.refresh_from_db()
        self.assertTrue(self.lecturer.check_password("TempPass@2026"))
        self.assertTrue(self.lecturer.must_change_password)
        self.assertEqual(response.data["temporary_password"], "TempPass@2026")

    def test_admin_cannot_reset_superadmin_password(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            self.url,
            {"user_id": self.superadmin.id, "new_password": "TempPass@2026"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_can_use_generated_password(self):
        self.client.force_authenticate(user=self.superadmin)

        response = self.client.post(
            self.url,
            {"username": self.lecturer.username},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        generated = response.data["temporary_password"]
        self.assertTrue(generated)
        self.lecturer.refresh_from_db()
        self.assertTrue(self.lecturer.check_password(generated))
        self.assertTrue(self.lecturer.must_change_password)

