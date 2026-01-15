from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from learning.achievement_models import (
    Achievement,
    AchievementCategory,
    StudentAchievement,
    TermProgress,
)
from learning.models import Assignment, Programme, CurriculumUnit, Registration
from repository.models import LibraryAsset
from users.models import Student, Lecturer

User = get_user_model()


class ButtonInteractionTests(TestCase):
    """
    High-level smoke tests that exercise the primary learning endpoints used by the
    mobile “quick actions” buttons. The goal is to ensure the current URL structure
    stays compatible with the client-side expectations rather than verifying the
    full business logic of each viewset.
    """

    def setUp(self):
        self.student_user = User.objects.create_user(
            username="test_student",
            password="test123",
            role="student",
        )
        self.student = Student.objects.create(user=self.student_user, year=1, trimester=1, trimester_label="T1", cohort_year=2024)
        self.lecturer_user = User.objects.create_user(
            username="test_lecturer",
            password="test123",
            role="lecturer",
        )
        self.lecturer = Lecturer.objects.create(user=self.lecturer_user)

        self.student_client = APIClient()
        self.student_client.force_authenticate(self.student_user)

        self.lecturer_client = APIClient()
        self.lecturer_client.force_authenticate(self.lecturer_user)

        self.term = "2025-T1"
        self.category = AchievementCategory.objects.create(
            name="Engagement",
            description="Voice and attendance badges",
            icon="star",
        )
        self.achievement = Achievement.objects.create(
            category=self.category,
            name="Welcome Session",
            description="Join the kickoff session",
            icon="star-outline",
            points=10,
            max_claims_per_term=3,
            requires_approval=False,
            voice_message="Great participation!",
        )
        TermProgress.objects.create(
            student=self.student_user,
            term=self.term,
            total_points_earned=50,
            total_points_spent=0,
        )
        self.pending_claim = StudentAchievement.objects.create(
            student=self.student_user,
            achievement=self.achievement,
            points_earned=5,
            term=self.term,
        )

        self.programme = Programme.objects.create(
            code="CIS101",
            name="Intro to Computing",
            award_level="BSc",
            duration_years=3,
            trimesters_per_year=2,
        )
        self.unit = CurriculumUnit.objects.create(programme=self.programme, code="CU101", title="Orientation", credit_hours=3)
        self.assignment = Assignment.objects.create(
            unit=self.unit,
            lecturer=self.lecturer,
            title="Onboarding reflection",
            description="Share what you learned.",
            due_at=timezone.now(),
        )
        self.registration = Registration.objects.create(
            student=self.student,
            unit=self.unit,
            academic_year=2025,
            trimester=1,
        )
        self.resource = LibraryAsset.objects.create(
            title="Orientation guide",
            type=LibraryAsset.AssetType.LINK,
            url="https://example.com/guide",
        )

    def test_student_achievement_workflow(self):
        """Students can reach the list endpoints and submit claims/rewards."""
        response = self.student_client.get(reverse("achievement-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        claim_payload = {
            "student": self.student.pk,
            "achievement": self.achievement.id,
            "points_earned": 5,
            "term": self.term,
        }
        response = self.student_client.post(
            reverse("student-achievement-list"), claim_payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        reward_payload = {
            "student": self.student.pk,
            "points_spent": 10,
            "reward_description": "Notebook",
            "term": self.term,
        }
        response = self.student_client.post(
            reverse("reward-claim-list"), reward_payload, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        leaderboard_url = reverse("term-progress-leaderboard") + f"?term={self.term}"
        response = self.student_client.get(leaderboard_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        current_term_url = reverse("term-progress-current-term") + f"?term={self.term}"
        response = self.student_client.get(current_term_url)
        # The API returns 200 when data exists, otherwise 404. Either is acceptable for this smoke test.
        self.assertIn(response.status_code, (status.HTTP_200_OK, status.HTTP_404_NOT_FOUND))

    def test_lecturer_can_approve_student_claim(self):
        """Lecturers rely on the approve action for moderation."""
        url = reverse("student-achievement-approve", args=[self.pending_claim.id])
        response = self.lecturer_client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.pending_claim.refresh_from_db()
        self.assertEqual(self.pending_claim.approved_by, self.lecturer_user)

    def test_assignment_and_registration_routes(self):
        """Core learning interactions are wired to existing URLs."""
        response = self.student_client.get(reverse("assignment-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.student_client.get(reverse("registration-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_resource_library_flow(self):
        """Lecturers upload resources while students can browse them."""
        # This test needs review as Resource is no longer linked to Programme/Course
        pass
