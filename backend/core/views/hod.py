from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Count
from core.models import Department
from learning.models import Programme, Registration, CurriculumUnit, LecturerAssignment
from finance.models import FinanceStatus, FinanceThreshold
from users.models import HOD, Student
from users.serializers import StudentSerializer
from core.serializers import HODSerializer

User = get_user_model()


class HODViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = HOD.objects.all()
    serializer_class = HODSerializer

    @action(detail=True, methods=['get'])
    def eligibles(self, request, pk=None):
        hod = self.get_object()
        department = hod.department

        # Get programmes in the HOD's department
        programmes = department.programmes.all()

        # Get the latest finance thresholds for those programmes
        thresholds = FinanceThreshold.objects.filter(programme__in=programmes).distinct('programme').order_by('programme', '-academic_year', '-trimester')

        # Get students who have met the threshold
        eligible_students = Student.objects.none()
        for threshold in thresholds:
            students_in_programme = Student.objects.filter(programme=threshold.programme)
            finance_statuses = FinanceStatus.objects.filter(
                student__in=students_in_programme,
                academic_year=threshold.academic_year,
                trimester=threshold.trimester,
                total_paid__gte=threshold.threshold_amount
            )
            eligible_students |= students_in_programme.filter(id__in=finance_statuses.values('student_id'))

        serializer = StudentSerializer(eligible_students, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def approve_registrations(self, request):
        registration_ids = request.data.get('registration_ids', [])
        registrations = Registration.objects.filter(id__in=registration_ids)
        registrations.update(status=Registration.Status.APPROVED)
        return Response({'detail': f'{len(registrations)} registrations approved.'})


class DepartmentViewSet(viewsets.ModelViewSet):
    """
    API endpoint for department management.
    Only HODs and admins can access.
    """
    # serializer_class = DepartmentSerializer # Serializer to be updated
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Department.objects.all()
        # Assuming HOD profile is linked from user
        if hasattr(user, 'hod_profile') and user.hod_profile.department:
            return Department.objects.filter(pk=user.hod_profile.department.pk)
        return Department.objects.none()

    @action(detail=True, methods=['get'])
    def lecturers(self, request, pk=None):
        """Get all lecturers in this department"""
        department = self.get_object()
        lecturers = department.lecturer_set.all().annotate(
            unit_count=Count('assignments')
        )
        # serializer = LecturerSerializer(lecturers, many=True) # Serializer to be updated
        # return Response(serializer.data)
        return Response([{"id": l.user_id, "name": l.user.display_name, "unit_count": l.unit_count} for l in lecturers]) # Placeholder response


    @action(detail=True, methods=['get'])
    def programmes(self, request, pk=None):
        """Get all programmes in this department"""
        department = self.get_object()
        programmes = (
            Programme.objects.filter(department=department)
            .prefetch_related('curriculum_units')
            .order_by('code')
        )
        # serializer = ProgrammeAssignmentSerializer(programmes, many=True) # Serializer to be updated
        # return Response(serializer.data)
        return Response([{"id": p.id, "name": p.name} for p in programmes]) # Placeholder

    # TODO: Refactor the logic below to align with new models and workflows
    # The following actions are complex and depend on the new registration and assignment logic.
    # They will be addressed after the initial model migration is successful.

    # @action(detail=True, methods=['post'])
    # def add_lecturer(self, request, pk=None):
    #     ...

    # @action(detail=True, methods=['post'])
    # def assign_lecturer_to_unit(self, request, pk=None):
    #     ...

    # @action(detail=True, methods=['post'])
    # def approve_registration(self, request, pk=None):
    #     ...

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        """List students registered for units within this department's programmes"""
        department = self.get_object()
        registrations = (
            Registration.objects.filter(unit__programme__department=department)
            .select_related('student__user', 'unit')
            .order_by('student__user__username')
        )
        student_map = {}
        for reg in registrations:
            student_profile = reg.student
            user = student_profile.user
            entry = student_map.setdefault(
                student_profile.user_id,
                {
                    'id': user.id,
                    'username': user.username,
                    'display_name': user.display_name or user.username,
                    'unit_ids': set(),
                    'unit_codes': [],
                },
            )
            entry['unit_ids'].add(reg.unit_id)
            code = reg.unit.code or reg.unit.title
            if code not in entry['unit_codes']:
                entry['unit_codes'].append(code)
        
        results = [
            {
                'id': data['id'],
                'username': data['username'],
                'display_name': data['display_name'],
                'unit_ids': list(data['unit_ids']),
                'unit_codes': data['unit_codes'],
            }
            for data in student_map.values()
        ]
        # serializer = StudentSummarySerializer(results, many=True) # Serializer to be updated
        # return Response(serializer.data)
        return Response(results) # Placeholder response


    # @action(detail=True, methods=['post'])
    # def create_programme(self, request, pk=None):
    #     ...

    # @action(detail=True, methods=['post'])
    # def register_students_for_unit(self, request, pk=None):
        # ...

class HodDashboardViewSet(viewsets.ViewSet):
    """
    API endpoint for HOD dashboard.
    Provides overview and statistics for department management.
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        user = request.user
        if not user.is_staff or (not user.is_superuser and not hasattr(user, 'hod_profile')):
            return Response(
                {'error': 'Not authorized'},
                status=status.HTTP_403_FORBIDDEN
            )

        departments = Department.objects.filter(head_of_department__user=user) if not user.is_superuser else Department.objects.all()
        
        dashboard_data = []
        for dept in departments:
            programmes = Programme.objects.filter(department=dept)
            lecturers = dept.lecturer_set.all()
            
            dept_data = {
                'department': {
                    'id': dept.id,
                    'name': dept.name,
                    'code': dept.code,
                },
                'statistics': {
                    'total_programmes': programmes.count(),
                    'total_lecturers': lecturers.count(),
                },
                # 'recent_programmes': ProgrammeAssignmentSerializer(
                #     programmes.order_by('-created_at')[:5],
                #     many=True
                # ).data, # Serializer to be updated
                # 'recent_lecturers': LecturerSerializer(
                #     lecturers.order_by('-user__date_joined')[:5],
                #     many=True
                # ).data, # Serializer to be updated
            }
            dashboard_data.append(dept_data)
            
        return Response(dashboard_data)
