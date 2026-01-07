from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError

from users.models import User
from ..models import Submission
from ..progress_models import CompletionRecord
from ..serializers.assignments import SubmissionSerializer


class LecturerGradingViewSet(viewsets.ModelViewSet):
    serializer_class = SubmissionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role != User.Roles.LECTURER:
            return Submission.objects.none()
        
        try:
            lecturer_profile = user.lecturer_profile
            return Submission.objects.filter(assignment__lecturer=lecturer_profile)
        except User.lecturer_profile.RelatedObjectDoesNotExist:
            return Submission.objects.none()

    def partial_update(self, request, pk=None):
        submission = self.get_object()
        user = self.request.user

        try:
            lecturer_profile = user.lecturer_profile
            if submission.assignment.lecturer != lecturer_profile:
                raise PermissionDenied("You can only grade submissions for your own assignments.")
        except User.lecturer_profile.RelatedObjectDoesNotExist:
            raise PermissionDenied("You must be a lecturer to grade submissions.")

        grade = request.data.get('grade')
        if grade is None:
            raise ValidationError("Grade is required.")

        submission.grade = grade
        submission.save()

        # Create or update completion record
        completion_record, created = CompletionRecord.objects.update_or_create(
            student=submission.student,
            programme=submission.student.programme,
            unit=submission.assignment.unit,
            assignment=submission.assignment,
            defaults={
                'score': grade,
                'completion_type': 'teacher_verified',
                'verified_by': user,
            }
        )
        
        # Here you could add logic to check if all assignments for the unit are graded
        # and then mark the unit as complete for the student.

        return Response(self.get_serializer(submission).data)

