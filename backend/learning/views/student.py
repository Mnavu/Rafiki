from rest_framework import viewsets, status
from rest_framework.generics import ListAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError

from users.models import Student, Lecturer
from users.serializers import UserSerializer
from ..models import Registration, CurriculumUnit
from ..serializers import RegistrationSerializer


class StudentUnitSelectionViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def create(self, request):
        user = request.user
        if user.role != 'student':
            raise PermissionDenied("Only students can select units.")

        try:
            student_profile = user.student_profile
        except Student.DoesNotExist:
            raise ValidationError("A student profile is required.")

        if student_profile.current_status != Student.Status.FINANCE_OK:
            raise PermissionDenied(f"Fee clearance required before unit selection. Your status is {student_profile.current_status}")

        unit_ids = request.data.get('unit_ids', [])
        if not isinstance(unit_ids, list) or not unit_ids:
            raise ValidationError("Please provide a list of unit_ids.")

        units = CurriculumUnit.objects.filter(id__in=unit_ids)
        if len(units) != len(unit_ids):
            raise ValidationError("One or more unit IDs are invalid.")
            
        # Assuming the current academic year and trimester are on the student profile
        # If not, this needs to be passed in the request
        academic_year = student_profile.year
        trimester = student_profile.trimester

        registrations = []
        for unit in units:
            reg, created = Registration.objects.get_or_create(
                student=student_profile,
                unit=unit,
                academic_year=academic_year,
                trimester=trimester,
                defaults={'status': Registration.Status.PENDING_HOD}
            )
            if not created and reg.status != Registration.Status.DRAFT:
                # Or handle this case differently, e.g., allow re-submission
                continue
            
            reg.status = Registration.Status.PENDING_HOD
            reg.save()
            registrations.append(reg)

        student_profile.current_status = Student.Status.PENDING_HOD
        student_profile.save()
        
        serializer = RegistrationSerializer(registrations, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class StudentLecturersView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role != 'student':
            return Lecturer.objects.none()
        
        try:
            student_profile = user.student_profile
        except Student.DoesNotExist:
            return Lecturer.objects.none()

        approved_registrations = Registration.objects.filter(
            student=student_profile,
            status=Registration.Status.APPROVED
        )
        unit_ids = approved_registrations.values_list('unit_id', flat=True)
        
        from learning.models import LecturerAssignment
        lecturer_ids = LecturerAssignment.objects.filter(unit_id__in=unit_ids).values_list('lecturer_id', flat=True)
        
        return User.objects.filter(lecturer_profile__id__in=lecturer_ids)
