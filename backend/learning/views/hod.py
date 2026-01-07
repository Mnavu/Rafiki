from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError

from users.models import User, Student
from ..models import Registration, LecturerAssignment
from ..serializers import RegistrationSerializer


class HodUnitApprovalViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RegistrationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role != User.Roles.HOD:
            return Registration.objects.none()
        
        # HOD can only see registrations for their department's programmes
        hod_profile = user.hod_profile
        return Registration.objects.filter(
            status=Registration.Status.PENDING_HOD,
            unit__programme__department=hod_profile.department
        )

    @action(detail=False, methods=['post'])
    def approve_registrations(self, request):
        user = self.request.user
        if user.role != User.Roles.HOD:
            raise PermissionDenied("Only HODs can approve registrations.")

        registration_ids = request.data.get('registration_ids', [])
        if not isinstance(registration_ids, list) or not registration_ids:
            raise ValidationError("Please provide a list of registration_ids to approve.")
        
        hod_profile = user.hod_profile
        registrations = Registration.objects.filter(
            id__in=registration_ids,
            status=Registration.Status.PENDING_HOD,
            unit__programme__department=hod_profile.department
        )

        if len(registrations) != len(registration_ids):
            raise ValidationError("One or more registration IDs are invalid or not pending your approval.")

        updated_registrations = []
        students_to_activate = set()
        for reg in registrations:
            reg.status = Registration.Status.APPROVED
            reg.approved_by = user
            reg.approved_at = timezone.now()
            reg.save()
            updated_registrations.append(reg)
            students_to_activate.add(reg.student)

        # Activate students
        for student in students_to_activate:
            student.current_status = Student.Status.ACTIVE
            student.save()
            
        serializer = RegistrationSerializer(updated_registrations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


    @action(detail=False, methods=['post'])
    def reject_registrations(self, request):
        user = self.request.user
        if user.role != User.Roles.HOD:
            raise PermissionDenied("Only HODs can reject registrations.")

        registration_ids = request.data.get('registration_ids', [])
        rejection_reason = request.data.get('reason', 'Not specified') # Optional reason
        if not registration_ids:
            raise ValidationError("Please provide a list of registration_ids to reject.")

        hod_profile = user.hod_profile
        registrations = Registration.objects.filter(
            id__in=registration_ids,
            status=Registration.Status.PENDING_HOD,
            unit__programme__department=hod_profile.department
        )

        if len(registrations) != len(registration_ids):
            raise ValidationError("One or more registration IDs are invalid or not pending your approval.")

        for reg in registrations:
            reg.status = Registration.Status.REJECTED
            # We can add a field to the model for rejection reason if needed
            reg.save()

        # What should the student status be? Back to FINANCE_OK?
        # This needs clarification, for now, we'll leave it as PENDING_HOD
        # so they can re-submit.

        return Response({"status": "rejected", "reason": rejection_reason}, status=status.HTTP_200_OK)
