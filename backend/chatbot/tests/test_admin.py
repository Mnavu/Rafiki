from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from chatbot.models import ChatbotAnswerFeedback, Conversation, Turn

User = get_user_model()


class ChatbotFeedbackAdminTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username="admin_chatbot_feedback",
            email="admin_chatbot_feedback@example.com",
            password="Password@2026",
        )
        self.student_user = User.objects.create_user(
            username="feedback_student",
            password="Password@2026",
            role=User.Roles.STUDENT,
            display_name="Feedback Student",
        )
        self.conversation = Conversation.objects.create(user=self.student_user, title="Student assistant")
        self.turn = Turn.objects.create(
            conversation=self.conversation,
            sender="bot",
            text="Here is your chatbot answer.",
        )
        self.not_helpful = ChatbotAnswerFeedback.objects.create(
            user=self.student_user,
            conversation=self.conversation,
            turn=self.turn,
            rating=ChatbotAnswerFeedback.Rating.NOT_HELPFUL,
            query_text="Where do I find study materials?",
            answer_text="Open class communities and assignments.",
            needs_review=True,
        )

        second_turn = Turn.objects.create(
            conversation=self.conversation,
            sender="bot",
            text="Another answer.",
        )
        self.helpful = ChatbotAnswerFeedback.objects.create(
            user=self.student_user,
            conversation=self.conversation,
            turn=second_turn,
            rating=ChatbotAnswerFeedback.Rating.HELPFUL,
            query_text="When is my next class?",
            answer_text="Your next class is tomorrow at 9 AM.",
            needs_review=False,
        )
        self.client.force_login(self.admin_user)

    def test_admin_filter_can_show_only_not_useful_feedback(self):
        response = self.client.get(
            reverse("admin:chatbot_chatbotanswerfeedback_changelist"),
            {"feedback_queue": "not_useful"},
        )

        self.assertEqual(response.status_code, 200)
        queryset = response.context["cl"].queryset
        self.assertEqual(queryset.count(), 1)
        self.assertEqual(queryset.first().pk, self.not_helpful.pk)

    def test_change_page_shows_mark_reviewed_button(self):
        response = self.client.get(
            reverse("admin:chatbot_chatbotanswerfeedback_change", args=[self.not_helpful.pk])
        )

        self.assertEqual(response.status_code, 200)
        self.assertContains(
            response,
            reverse("admin:chatbot_chatbotanswerfeedback_mark_reviewed", args=[self.not_helpful.pk]),
        )
        self.assertContains(response, "Mark reviewed")

    def test_mark_reviewed_admin_view_updates_feedback(self):
        response = self.client.get(
            reverse("admin:chatbot_chatbotanswerfeedback_mark_reviewed", args=[self.not_helpful.pk])
        )

        self.assertEqual(response.status_code, 302)
        self.not_helpful.refresh_from_db()
        self.assertFalse(self.not_helpful.needs_review)
        self.assertEqual(self.not_helpful.reviewed_by, self.admin_user)
        self.assertIsNotNone(self.not_helpful.reviewed_at)
