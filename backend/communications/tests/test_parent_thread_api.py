from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from project_tests.mixins import ParentStudentFixtureMixin
from communications.models import Thread, Message
from notifications.models import Notification


class ParentThreadApiTests(ParentStudentFixtureMixin, APITestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=self.parent_user)

    def test_parent_can_list_threads(self):
        response = self.client.get("/api/communications/threads/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data), 1)
        thread = data[0]
        self.assertEqual(thread["id"], self.thread.id)
        self.assertEqual(len(thread["messages"]), 2)
        self.assertEqual(thread["messages"][0]["sender_role"], Message.SenderRoles.PARENT)

    def test_parent_post_message_sets_sender_role(self):
        payload = {"thread": self.thread.id, "body": "Thanks for the update!"}
        with patch("notifications.delivery.send_expo_push"):
            response = self.client.post("/api/communications/messages/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["sender_role"], 'parent')
        self.assertEqual(Message.objects.filter(thread=self.thread).count(), 3)
        self.assertEqual(
            Notification.objects.filter(
                type="thread_message_received",
                user=self.teacher_user,
                payload__thread_id=self.thread.id,
            ).count(),
            1,
        )
        self.assertEqual(
            Notification.objects.filter(
                type="thread_message_received",
                user=self.student_user,
                payload__thread_id=self.thread.id,
            ).count(),
            1,
        )

    def test_direct_student_message_notifies_lecturer_only(self):
        direct_thread = Thread.objects.create(
            subject="Direct support",
            student=self.student_user,
            teacher=self.teacher_user,
        )
        self.client.force_authenticate(user=self.student_user)
        payload = {"thread": direct_thread.id, "body": "Hello lecturer"}
        with patch("notifications.delivery.send_expo_push"):
            response = self.client.post("/api/communications/messages/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            Notification.objects.filter(
                type="thread_message_received",
                user=self.teacher_user,
                payload__thread_id=direct_thread.id,
            ).count(),
            1,
        )
        self.assertEqual(
            Notification.objects.filter(
                type="thread_message_received",
                user=self.student_user,
                payload__thread_id=direct_thread.id,
            ).count(),
            0,
        )

    def test_parent_cannot_access_unrelated_thread(self):
        other_thread = Thread.objects.create(
            subject="Other",
            student=self.unlinked_student_user,
            teacher=self.teacher_user,
            parent=self.other_parent_user,
        )
        response = self.client.get("/api/communications/threads/")
        ids = {item["id"] for item in response.json()}
        self.assertNotIn(other_thread.id, ids)

    def test_lecturer_can_stream_student_voice_note_from_thread(self):
        direct_thread = Thread.objects.create(
            subject="Direct support",
            student=self.student_user,
            teacher=self.teacher_user,
        )
        audio = SimpleUploadedFile(
            "voice-note.m4a",
            b"fake-audio-content",
            content_type="audio/m4a",
        )
        message = Message.objects.create(
            thread=direct_thread,
            author=self.student_user,
            sender_role=Message.SenderRoles.STUDENT,
            audio=audio,
        )

        self.client.force_authenticate(user=self.teacher_user)
        response = self.client.get(f"/api/communications/messages/{message.id}/audio/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("inline;", response["Content-Disposition"])

    def test_unrelated_parent_cannot_stream_other_thread_voice_note(self):
        other_thread = Thread.objects.create(
            subject="Other",
            student=self.unlinked_student_user,
            teacher=self.teacher_user,
            parent=self.other_parent_user,
        )
        audio = SimpleUploadedFile(
            "voice-note.m4a",
            b"fake-audio-content",
            content_type="audio/m4a",
        )
        message = Message.objects.create(
            thread=other_thread,
            author=self.teacher_user,
            sender_role=Message.SenderRoles.TEACHER,
            audio=audio,
        )

        self.client.force_authenticate(user=self.parent_user)
        response = self.client.get(f"/api/communications/messages/{message.id}/audio/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
