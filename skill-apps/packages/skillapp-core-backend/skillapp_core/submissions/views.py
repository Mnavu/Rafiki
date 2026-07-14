from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import GenericAPIView

from skillapp_core.accounts.utils import linked_learner_ids_for_mentor
from skillapp_core.curriculum.models import Milestone

from .models import MilestoneSubmission, SubmissionStatus
from .permissions import IsLinkedMentor
from .serializers import MilestoneSubmissionSerializer, SubmissionReviewSerializer


class SubmitMilestoneView(APIView):
    """Learner submits (or resubmits) proof of a milestone. Upsert-on-resubmit:
    one row per (learner, milestone), reset to pending, previous feedback
    remains visible until the mentor reviews again.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, milestone_id):
        if not getattr(request.user, "is_learner", False):
            raise PermissionDenied("Only learners submit milestones.")
        milestone = Milestone.objects.get(pk=milestone_id)

        defaults = {"status": SubmissionStatus.PENDING, "reviewed_by": None, "reviewed_at": None}
        for field in ("photo", "video", "learner_note_text", "learner_audio", "learner_audio_transcript"):
            if field in request.data:
                defaults[field] = request.data[field]

        submission, _ = MilestoneSubmission.objects.update_or_create(
            learner=request.user, milestone=milestone, defaults=defaults
        )

        from skillapp_core.accounts.utils import get_mentor_link_model
        from skillapp_core.notifications.services import notify_new_submission

        Link = get_mentor_link_model()
        mentor_ids = Link.objects.filter(learner=request.user, can_review=True).values_list("mentor_id", flat=True)
        notify_new_submission(submission, mentor_ids)

        return Response(MilestoneSubmissionSerializer(submission).data, status=201)


class MySubmissionsView(generics.ListAPIView):
    serializer_class = MilestoneSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return MilestoneSubmission.objects.filter(learner=self.request.user)


class MentorInboxView(generics.ListAPIView):
    """Pending submissions across every learner linked to the requesting mentor."""

    serializer_class = MilestoneSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if not getattr(self.request.user, "is_mentor", False):
            return MilestoneSubmission.objects.none()
        learner_ids = linked_learner_ids_for_mentor(self.request.user)
        return MilestoneSubmission.objects.filter(learner_id__in=learner_ids, status=SubmissionStatus.PENDING)


class SubmissionReviewView(GenericAPIView):
    permission_classes = [permissions.IsAuthenticated, IsLinkedMentor]
    queryset = MilestoneSubmission.objects.select_related("learner", "milestone")

    def post(self, request, submission_id):
        submission = get_object_or_404(
            MilestoneSubmission.objects.select_related("learner", "milestone"), pk=submission_id
        )
        self.check_object_permissions(request, submission)

        payload = SubmissionReviewSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        review = payload.validated_data

        submission.status = review["status"]
        submission.reviewed_by = request.user
        submission.reviewed_at = timezone.now()
        submission.feedback_text = review.get("feedback_text", "")
        if review.get("feedback_audio"):
            submission.feedback_audio = review["feedback_audio"]
        submission.save()

        if review["status"] == SubmissionStatus.APPROVED and review.get("award_points"):
            from skillapp_core.rewards.services import award_for_submission

            award_for_submission(
                submission=submission,
                awarded_by=request.user,
                points=review["award_points"],
                badge_code=review.get("badge_code") or "",
                reason=f"Milestone approved: {submission.milestone.title}",
            )

        from skillapp_core.notifications.services import notify_submission_reviewed

        notify_submission_reviewed(submission)

        return Response(
            {
                "id": submission.id,
                "status": submission.status,
                "reviewed_at": submission.reviewed_at,
            }
        )
