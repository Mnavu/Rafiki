from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from skillapp_core.curriculum.models import LessonStep

from .models import ChecklistCompletion, LearnerLessonProgress
from .serializers import LearnerLessonProgressSerializer
from .services import mark_step_complete


class CompleteChecklistStepView(APIView):
    """Learner or a linked mentor taps a step as done.

    Mentors are allowed to mark on the learner's behalf (e.g. helping a child
    who can't yet operate the checkbox themselves) provided `learner_id` names
    a learner they're actually linked to.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, step_id):
        lesson_step = LessonStep.objects.select_related("lesson").get(pk=step_id)
        user = request.user

        if getattr(user, "is_learner", False):
            learner = user
        else:
            from skillapp_core.accounts.utils import mentor_can_review_learner

            learner_id = request.data.get("learner_id")
            if not learner_id:
                return Response({"detail": "learner_id is required for mentors."}, status=400)
            learner_model = user.__class__
            try:
                learner = learner_model.objects.get(pk=learner_id, role="learner")
            except learner_model.DoesNotExist:
                return Response({"detail": "Learner not found."}, status=404)
            if not mentor_can_review_learner(user, learner):
                return Response({"detail": "Not linked to this learner."}, status=403)

        completion = mark_step_complete(learner=learner, lesson_step=lesson_step, marked_by=user)
        return Response(
            {
                "lesson_step_id": completion.lesson_step_id,
                "practice_count": completion.practice_count,
                "completed_at": completion.completed_at,
            }
        )


class LessonStepStatusView(APIView):
    """Per-step completion status for the requesting learner, so a lesson
    player screen can show existing checkmarks instead of always starting
    from a blank checklist."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, lesson_code):
        completions = ChecklistCompletion.objects.filter(
            learner=request.user, lesson_step__lesson__code=lesson_code
        )
        return Response(
            {
                str(c.lesson_step_id): {"completed": True, "practice_count": c.practice_count}
                for c in completions
            }
        )


def _progress_payload(learner) -> dict:
    rows = LearnerLessonProgress.objects.filter(learner=learner).select_related("lesson", "lesson__module")
    serialized = LearnerLessonProgressSerializer(rows, many=True).data
    steps_completed = sum(r["steps_completed"] for r in serialized)
    steps_total = sum(r["steps_total"] for r in serialized)
    completed_lessons = sum(1 for r in serialized if r["status"] == LearnerLessonProgress.Status.COMPLETED)
    return {
        "completed_lessons": completed_lessons,
        "total_lessons": len(serialized),
        "steps_completed": steps_completed,
        "steps_total": steps_total,
        "lessons": serialized,
    }


class MyProgressView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(_progress_payload(request.user))


class LearnerProgressForMentorView(APIView):
    """Read-only progress for a specific learner, gated by an active,
    review-capable mentor link (mirrors IsLinkedMentor's check)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, learner_id):
        from skillapp_core.accounts.utils import mentor_can_review_learner

        learner_model = request.user.__class__
        try:
            learner = learner_model.objects.get(pk=learner_id, role="learner")
        except learner_model.DoesNotExist:
            return Response({"detail": "Learner not found."}, status=404)

        if not mentor_can_review_learner(request.user, learner):
            return Response({"detail": "Not linked to this learner."}, status=403)

        return Response(_progress_payload(learner))
