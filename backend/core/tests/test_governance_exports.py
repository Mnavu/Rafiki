from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import AuditLog
from users.models import User


class GovernanceAuditExportTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_user = User.objects.create_user(
            username="admin_export",
            email="admin_export@example.com",
            password="Password@2026",
            role=User.Roles.ADMIN,
            is_staff=True,
        )
        AuditLog.objects.create(
            actor_user=self.admin_user,
            action="user_login",
            target_table="users.User",
            target_id=str(self.admin_user.id),
            request_method="POST",
            request_path="/api/token/",
            request_status=200,
        )

    def test_admin_can_download_audit_log_csv(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(reverse("governance-audit-download-csv"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "text/csv")
        self.assertIn("attachment; filename=\"audit-logs.csv\"", response["Content-Disposition"])
        csv_body = response.content.decode("utf-8")
        self.assertIn("actor_username", csv_body)
        self.assertIn("admin_export", csv_body)
        self.assertIn("user_login", csv_body)

