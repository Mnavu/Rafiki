from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from notifications.models import Notification

User = get_user_model()


class NotificationViewSetTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="notify_user",
            password="password123",
            role=User.Roles.STUDENT,
        )
        self.client.force_authenticate(self.user)
        self.notification = Notification.objects.create(
            user=self.user,
            type="submission_graded",
            channel=Notification.Channel.IN_APP,
            payload={"title": "Grade posted"},
            send_at="2026-03-23T10:00:00Z",
            status=Notification.Status.SENT,
        )

    def test_mark_read_updates_notification_status(self):
        response = self.client.post(f"/api/notifications/{self.notification.id}/mark_read/")
        self.assertEqual(response.status_code, 200)
        self.notification.refresh_from_db()
        self.assertEqual(self.notification.status, Notification.Status.READ)

    def test_mark_all_read_updates_unread_notifications(self):
        Notification.objects.create(
            user=self.user,
            type="class_call_scheduled",
            channel=Notification.Channel.IN_APP,
            payload={"title": "Call"},
            send_at="2026-03-23T10:05:00Z",
            status=Notification.Status.SENT,
        )
        response = self.client.post("/api/notifications/mark_all_read/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            Notification.objects.filter(user=self.user, status=Notification.Status.READ).count(),
            2,
        )
