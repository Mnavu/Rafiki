from rest_framework import status
from rest_framework.test import APITestCase

from project_tests.mixins import ParentStudentFixtureMixin
from communications.models import Thread, Message


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
        response = self.client.post("/api/communications/messages/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["sender_role"], 'parent')
        self.assertEqual(Message.objects.filter(thread=self.thread).count(), 3)

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
