from django.utils import timezone
from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from core.mixins import ScopedListMixin
from core.permissions import IsSelfOrElevated
from learning.models import Assignment, LecturerAssignment, Registration, Submission
from learning.serializers import AssignmentSerializer, RegistrationSerializer, SubmissionSerializer
from users.models import User


class AssignmentViewSet(ScopedListMixin, viewsets.ModelViewSet):
    queryset = Assignment.objects.select_related("unit", "unit__programme", "lecturer")
    serializer_class = AssignmentSerializer
    permission_classes = [permissions.IsAuthenticated, IsSelfOrElevated]

    def get_queryset(self):
        qs = super().get_queryset()
        unit_id = self.request.query_params.get("unit")
        if unit_id:
            qs = qs.filter(unit_id=unit_id)
        return qs

    def _get_lecturer_profile(self, user):
        try:
            return user.lecturer_profile
        except Exception as exc:
            raise PermissionDenied("Lecturer profile is missing.") from exc

    def _validate_lecturer_unit_access(self, user, unit):
        lecturer_profile = self._get_lecturer_profile(user)
        if not unit:
            raise ValidationError({"unit": "Unit is required."})
        assigned = LecturerAssignment.objects.filter(
            lecturer=lecturer_profile,
            unit=unit,
        ).exists()
        if not assigned:
            raise PermissionDenied("You can only manage assignments for classes assigned to you.")
        return lecturer_profile

    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, "role", None) == User.Roles.LECTURER:
            unit = serializer.validated_data.get("unit")
            lecturer_profile = self._validate_lecturer_unit_access(user, unit)
            serializer.save(lecturer=lecturer_profile)
        elif user.is_staff or getattr(user, "role", None) in {User.Roles.ADMIN, User.Roles.HOD}:
            serializer.save()
        else:
            raise PermissionDenied("Only lecturers or admins can create assignments.")

    def perform_update(self, serializer):
        user = self.request.user
        assignment = self.get_object()
        if getattr(user, "role", None) == User.Roles.LECTURER:
            lecturer_profile = self._get_lecturer_profile(user)
            if assignment.lecturer_id and assignment.lecturer_id != lecturer_profile.pk:
                raise PermissionDenied("Lecturers can only update their own assignments.")
            target_unit = serializer.validated_data.get("unit", assignment.unit)
            self._validate_lecturer_unit_access(user, target_unit)
            serializer.save(lecturer=assignment.lecturer or lecturer_profile)
            return
        serializer.save(lecturer=assignment.lecturer)

    def perform_destroy(self, instance):
        user = self.request.user
        if getattr(user, "role", None) == User.Roles.LECTURER:
            lecturer_profile = self._get_lecturer_profile(user)
            if instance.lecturer_id and instance.lecturer_id != lecturer_profile.pk:
                raise PermissionDenied("Lecturers can only delete their own assignments.")
        instance.delete()


class SubmissionViewSet(ScopedListMixin, viewsets.ModelViewSet):
    queryset = Submission.objects.select_related("assignment", "student")
    serializer_class = SubmissionSerializer
    permission_classes = [permissions.IsAuthenticated, IsSelfOrElevated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = super().get_queryset()
        assignment_id = self.request.query_params.get("assignment")
        if assignment_id:
            qs = qs.filter(assignment_id=assignment_id)
        return qs

    def _validate_student_assignment_access(self, user, assignment):
        if not assignment:
            raise ValidationError({"assignment": "Assignment is required."})
        if getattr(user, "role", None) != User.Roles.STUDENT:
            raise PermissionDenied("Only students can submit assignment work.")
        if not hasattr(user, "student_profile"):
            raise PermissionDenied("Student profile is missing.")
        allowed = Registration.objects.filter(
            student=user.student_profile,
            unit=assignment.unit,
            status__in={
                Registration.Status.APPROVED,
                Registration.Status.SUBMITTED,
                Registration.Status.PENDING_HOD,
            },
        ).exists()
        if not allowed:
            raise PermissionDenied("You can only submit work for your own registered classes.")
        return user.student_profile

    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, "role", None) == User.Roles.STUDENT:
            assignment = serializer.validated_data.get("assignment")
            student_profile = self._validate_student_assignment_access(user, assignment)
            existing = (
                Submission.objects.filter(
                    assignment=assignment,
                    student=student_profile,
                )
                .order_by("-submitted_at", "-created_at")
                .first()
            )
            if existing:
                for field, value in serializer.validated_data.items():
                    setattr(existing, field, value)
                existing.student = student_profile
                existing.save()
                serializer.instance = existing
            else:
                serializer.save(student=student_profile)
        else:
            raise PermissionDenied("Only students can create submissions.")

    def perform_update(self, serializer):
        user = self.request.user
        submission = self.get_object()
        if getattr(user, "role", None) != User.Roles.STUDENT:
            raise PermissionDenied("Only students can update submissions from this workflow.")
        if submission.student_id != getattr(getattr(user, "student_profile", None), "pk", None):
            raise PermissionDenied("You can only update your own submission.")
        assignment = serializer.validated_data.get("assignment", submission.assignment)
        self._validate_student_assignment_access(user, assignment)
        serializer.save(student=user.student_profile)

    @action(detail=True, methods=['post'])
    def feedback(self, request, pk=None):
        submission = self.get_object()
        user = request.user
        if getattr(user, "role", None) != User.Roles.LECTURER:
            raise PermissionDenied("Only lecturers can provide feedback.")

        feedback_text = request.data.get('feedback_text')
        feedback_media_url = request.data.get('feedback_media_url')

        if not feedback_text and not feedback_media_url:
            return Response({'detail': 'Feedback text or media URL is required.'}, status=status.HTTP_400_BAD_REQUEST)

        submission.feedback_text = feedback_text
        submission.feedback_media_url = feedback_media_url
        submission.save(update_fields=['feedback_text', 'feedback_media_url'])

        serializer = self.get_serializer(submission)
        return Response(serializer.data)


class RegistrationViewSet(ScopedListMixin, viewsets.ModelViewSet):
    queryset = Registration.objects.select_related("student", "unit", "unit__programme")
    serializer_class = RegistrationSerializer
    permission_classes = [permissions.IsAuthenticated, IsSelfOrElevated]

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        unit_param = self.request.query_params.get("unit")
        if unit_param:
            qs = qs.filter(unit_id=unit_param)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if getattr(user, "role", None) == User.Roles.STUDENT:
            serializer.save(student=user)
        else:
            serializer.save()

    def perform_update(self, serializer):
        instance = self.get_object()
        user = self.request.user
        if serializer.validated_data.get("status") == "approved":
            serializer.save(approved_by=user, approved_at=timezone.now())
        else:
            serializer.save()
