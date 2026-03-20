from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from learning.models import Assignment, CurriculumUnit, LecturerAssignment, Programme
from users.models import Lecturer

User = get_user_model()


class LecturerAssignmentApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.lecturer_user = User.objects.create_user(
            username="lecturer_api",
            password="password123",
            role=User.Roles.LECTURER,
        )
        self.lecturer_profile = Lecturer.objects.create(user=self.lecturer_user)
        self.client.force_authenticate(self.lecturer_user)

        self.programme = Programme.objects.create(
            code="DTM-T",
            name="Tourism Test",
            award_level="Diploma",
            duration_years=2,
            trimesters_per_year=3,
        )
        self.unit = CurriculumUnit.objects.create(
            programme=self.programme,
            code="DTM-T101",
            title="Travel Basics",
            credit_hours=3,
            trimester_hint=1,
        )
        self.other_unit = CurriculumUnit.objects.create(
            programme=self.programme,
            code="DTM-T102",
            title="Travel Operations",
            credit_hours=3,
            trimester_hint=1,
        )
        LecturerAssignment.objects.create(
            lecturer=self.lecturer_profile,
            unit=self.unit,
            academic_year=2026,
            trimester=1,
        )

    def test_lecturer_can_create_update_and_delete_assignment_for_assigned_unit(self):
        create_response = self.client.post(
            reverse("assignment-list"),
            {
                "unit": self.unit.id,
                "title": "Week 4 Assignment",
                "description": "Prepare a travel itinerary.",
                "due_at": "2026-03-31T12:00:00Z",
            },
            format="json",
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        assignment_id = create_response.data["id"]
        assignment = Assignment.objects.get(pk=assignment_id)
        self.assertEqual(assignment.lecturer_id, self.lecturer_user.id)

        update_response = self.client.patch(
            reverse("assignment-detail", args=[assignment_id]),
            {
                "title": "Week 4 Updated Assignment",
            },
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        assignment.refresh_from_db()
        self.assertEqual(assignment.title, "Week 4 Updated Assignment")

        delete_response = self.client.delete(reverse("assignment-detail", args=[assignment_id]))
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Assignment.objects.filter(pk=assignment_id).exists())

    def test_lecturer_cannot_create_assignment_for_unassigned_unit(self):
        response = self.client.post(
            reverse("assignment-list"),
            {
                "unit": self.other_unit.id,
                "title": "Blocked Assignment",
                "description": "Should fail.",
                "due_at": "2026-03-31T12:00:00Z",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
