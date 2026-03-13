from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.utils import timezone
from core.models import Department
from learning.models import Programme, Registration, CurriculumUnit, LecturerAssignment, TermOffering
from finance.models import FinanceStatus, FinanceThreshold
from users.models import HOD, Student, Lecturer, User
from users.serializers import StudentSerializer
from core.serializers import HODSerializer, DepartmentSerializer

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
    HOD, records, and admin workflows are supported.
    """
    serializer_class = DepartmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _can_manage_department(self, user, department):
        if user.is_superuser or user.role in {User.Roles.ADMIN, User.Roles.RECORDS, User.Roles.SUPERADMIN}:
            return True
        if user.role == User.Roles.HOD and hasattr(user, 'hod_profile'):
            return user.hod_profile.department_id == department.id
        return False

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or user.role in {User.Roles.ADMIN, User.Roles.RECORDS, User.Roles.SUPERADMIN}:
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

    @action(detail=True, methods=['post'])
    def assign_hod(self, request, pk=None):
        department = self.get_object()
        if not self._can_manage_department(request.user, department):
            raise PermissionDenied("You are not allowed to assign HOD for this department.")
        hod_user_id = request.data.get("hod_user_id")
        if not hod_user_id:
            raise ValidationError({"detail": "hod_user_id is required."})
        try:
            hod_profile = HOD.objects.select_related("user").get(user_id=hod_user_id)
        except HOD.DoesNotExist:
            raise ValidationError({"detail": "HOD profile not found for the specified user."})
        previous_department_id = hod_profile.department_id
        current_hod = HOD.objects.filter(department=department).exclude(user_id=hod_profile.user_id).first()
        if current_hod:
            current_hod.department = None
            current_hod.save(update_fields=["department"])
        if previous_department_id and previous_department_id != department.id:
            Department.objects.filter(
                pk=previous_department_id,
                head_of_department=hod_profile,
            ).update(head_of_department=None)
        hod_profile.department = department
        hod_profile.save(update_fields=["department"])
        department.head_of_department = hod_profile
        department.save(update_fields=["head_of_department"])
        return Response(
            {
                "detail": "HOD assigned successfully.",
                "department_id": department.id,
                "hod_user_id": hod_profile.user_id,
                "hod_name": hod_profile.user.display_name or hod_profile.user.username,
            }
        )

    @action(detail=True, methods=['post'])
    def assign_lecturer(self, request, pk=None):
        department = self.get_object()
        if not self._can_manage_department(request.user, department):
            raise PermissionDenied("You are not allowed to assign lecturers for this department.")
        lecturer_user_id = request.data.get("lecturer_user_id")
        if not lecturer_user_id:
            raise ValidationError({"detail": "lecturer_user_id is required."})
        try:
            lecturer_profile = Lecturer.objects.select_related("user").get(user_id=lecturer_user_id)
        except Lecturer.DoesNotExist:
            raise ValidationError({"detail": "Lecturer profile not found for this user."})
        lecturer_profile.department = department
        lecturer_profile.save(update_fields=["department"])
        return Response(
            {
                "detail": "Lecturer assigned to department.",
                "department_id": department.id,
                "lecturer_user_id": lecturer_profile.user_id,
                "lecturer_name": lecturer_profile.user.display_name or lecturer_profile.user.username,
            }
        )

    @action(detail=True, methods=['post'])
    def remove_lecturer(self, request, pk=None):
        department = self.get_object()
        if not self._can_manage_department(request.user, department):
            raise PermissionDenied("You are not allowed to remove lecturers for this department.")
        lecturer_user_id = request.data.get("lecturer_user_id")
        if not lecturer_user_id:
            raise ValidationError({"detail": "lecturer_user_id is required."})
        lecturer_profile = Lecturer.objects.filter(
            user_id=lecturer_user_id,
            department=department,
        ).first()
        if not lecturer_profile:
            raise ValidationError({"detail": "Lecturer is not assigned to this department."})
        lecturer_profile.department = None
        lecturer_profile.save(update_fields=["department"])
        return Response(
            {
                "detail": "Lecturer removed from department.",
                "department_id": department.id,
                "lecturer_user_id": int(lecturer_user_id),
            }
        )

    @action(detail=True, methods=['get'])
    def available_staff(self, request, pk=None):
        department = self.get_object()
        if not self._can_manage_department(request.user, department):
            raise PermissionDenied("You are not allowed to view department staffing options.")
        hod_profiles = HOD.objects.select_related("user", "department").all()
        lecturer_profiles = Lecturer.objects.select_related("user", "department").all()
        return Response(
            {
                "hods": [
                    {
                        "user_id": profile.user_id,
                        "name": profile.user.display_name or profile.user.username,
                        "department_id": profile.department_id,
                        "department_name": profile.department.name if profile.department_id else None,
                        "is_current": profile.department_id == department.id,
                    }
                    for profile in hod_profiles
                ],
                "lecturers": [
                    {
                        "user_id": profile.user_id,
                        "name": profile.user.display_name or profile.user.username,
                        "department_id": profile.department_id,
                        "department_name": profile.department.name if profile.department_id else None,
                        "is_current": profile.department_id == department.id,
                    }
                    for profile in lecturer_profiles
                ],
            }
        )

    @action(detail=True, methods=['post'])
    def assign_offering_lecturer(self, request, pk=None):
        department = self.get_object()
        if not self._can_manage_department(request.user, department):
            raise PermissionDenied("You are not allowed to assign lecturers for this offering.")

        unit_id = request.data.get("unit_id")
        lecturer_user_id = request.data.get("lecturer_user_id")
        academic_year = request.data.get("academic_year")
        trimester = request.data.get("trimester")
        if not all([unit_id, lecturer_user_id, academic_year, trimester]):
            raise ValidationError(
                {"detail": "unit_id, lecturer_user_id, academic_year, and trimester are required."}
            )

        try:
            unit = CurriculumUnit.objects.select_related("programme").get(
                pk=unit_id,
                programme__department=department,
            )
        except CurriculumUnit.DoesNotExist:
            raise ValidationError({"detail": "Unit not found in this department."})

        try:
            lecturer_profile = Lecturer.objects.select_related("user").get(user_id=lecturer_user_id)
        except Lecturer.DoesNotExist:
            raise ValidationError({"detail": "Lecturer profile not found for this user."})

        if lecturer_profile.department_id != department.id:
            lecturer_profile.department = department
            lecturer_profile.save(update_fields=["department"])

        try:
            academic_year = int(academic_year)
            trimester = int(trimester)
        except (TypeError, ValueError):
            raise ValidationError({"detail": "academic_year and trimester must be integers."})
        removed_ids = list(
            LecturerAssignment.objects.filter(
                unit=unit,
                academic_year=academic_year,
                trimester=trimester,
            )
            .exclude(lecturer=lecturer_profile)
            .values_list("id", flat=True)
        )
        if removed_ids:
            LecturerAssignment.objects.filter(id__in=removed_ids).delete()

        assignment, _ = LecturerAssignment.objects.update_or_create(
            lecturer=lecturer_profile,
            unit=unit,
            academic_year=academic_year,
            trimester=trimester,
            defaults={},
        )

        if not TermOffering.objects.filter(
            unit=unit,
            programme=unit.programme,
            academic_year=academic_year,
            trimester=trimester,
            offered=True,
        ).exists():
            TermOffering.objects.update_or_create(
                unit=unit,
                programme=unit.programme,
                academic_year=academic_year,
                trimester=trimester,
                defaults={"offered": True},
            )

        return Response(
            {
                "detail": "Lecturer assigned for term offering.",
                "department_id": department.id,
                "assignment_id": assignment.id,
                "unit_id": unit.id,
                "unit_code": unit.code,
                "academic_year": academic_year,
                "trimester": trimester,
                "lecturer_user_id": lecturer_profile.user_id,
                "lecturer_name": lecturer_profile.user.display_name or lecturer_profile.user.username,
                "replaced_assignment_ids": removed_ids,
            }
        )

    @action(detail=True, methods=['post'])
    def clear_offering_lecturer(self, request, pk=None):
        department = self.get_object()
        if not self._can_manage_department(request.user, department):
            raise PermissionDenied("You are not allowed to clear lecturers for this offering.")

        unit_id = request.data.get("unit_id")
        academic_year = request.data.get("academic_year")
        trimester = request.data.get("trimester")
        if not all([unit_id, academic_year, trimester]):
            raise ValidationError({"detail": "unit_id, academic_year, and trimester are required."})

        try:
            unit = CurriculumUnit.objects.select_related("programme").get(
                pk=unit_id,
                programme__department=department,
            )
        except CurriculumUnit.DoesNotExist:
            raise ValidationError({"detail": "Unit not found in this department."})

        try:
            academic_year = int(academic_year)
            trimester = int(trimester)
        except (TypeError, ValueError):
            raise ValidationError({"detail": "academic_year and trimester must be integers."})
        removed_ids = list(
            LecturerAssignment.objects.filter(
                unit=unit,
                academic_year=academic_year,
                trimester=trimester,
            ).values_list("id", flat=True)
        )
        if removed_ids:
            LecturerAssignment.objects.filter(id__in=removed_ids).delete()

        return Response(
            {
                "detail": "Lecturer assignment cleared for offering.",
                "department_id": department.id,
                "unit_id": unit.id,
                "unit_code": unit.code,
                "academic_year": academic_year,
                "trimester": trimester,
                "removed_assignment_ids": removed_ids,
            }
        )


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

    @action(detail=True, methods=['get'])
    def structure(self, request, pk=None):
        department = self.get_object()
        hod_profile = HOD.objects.select_related("user").filter(department=department).first()
        lecturers = Lecturer.objects.select_related("user").filter(department=department)
        return Response(
            {
                "department": DepartmentSerializer(department).data,
                "hod": {
                    "user_id": hod_profile.user_id,
                    "name": hod_profile.user.display_name or hod_profile.user.username,
                }
                if hod_profile
                else None,
                "lecturers": [
                    {
                        "user_id": lecturer.user_id,
                        "name": lecturer.user.display_name or lecturer.user.username,
                    }
                    for lecturer in lecturers
                ],
            }
        )

    @action(detail=True, methods=['get'])
    def course_matrix(self, request, pk=None):
        """
        HOD matrix:
        - courses on offer by term/year
        - assigned lecturer per course
        - students grouped by study year
        """
        department = self.get_object()
        academic_year = request.query_params.get("academic_year")
        trimester = request.query_params.get("trimester")
        if not academic_year:
            academic_year = timezone.now().year
        academic_year = int(academic_year)

        offering_qs = TermOffering.objects.filter(
            programme__department=department,
            academic_year=academic_year,
            offered=True,
        ).select_related("programme", "unit")
        if trimester:
            offering_qs = offering_qs.filter(trimester=int(trimester))

        offered_unit_ids = list(offering_qs.values_list("unit_id", flat=True))
        lecturer_map = {
            row.unit_id: row
            for row in LecturerAssignment.objects.filter(
                unit_id__in=offered_unit_ids,
                academic_year=academic_year,
            ).select_related("lecturer__user")
        }
        reg_qs = Registration.objects.filter(
            unit_id__in=offered_unit_ids,
            academic_year=academic_year,
            status=Registration.Status.APPROVED,
        ).select_related("student__user", "unit")
        if trimester:
            reg_qs = reg_qs.filter(trimester=int(trimester))

        grouped = {}
        for reg in reg_qs:
            study_year = reg.student.year if reg.student_id else 0
            year_bucket = grouped.setdefault(study_year, {})
            unit_bucket = year_bucket.setdefault(
                reg.unit_id,
                {
                    "unit_id": reg.unit_id,
                    "unit_code": reg.unit.code,
                    "unit_title": reg.unit.title,
                    "students": [],
                },
            )
            if reg.student_id:
                unit_bucket["students"].append(
                    {
                        "student_user_id": reg.student.user_id,
                        "student_name": reg.student.user.display_name or reg.student.user.username,
                    }
                )

        years_payload = []
        for study_year, units in sorted(grouped.items(), key=lambda item: item[0]):
            courses = []
            for unit_id, info in units.items():
                assignment = lecturer_map.get(unit_id)
                lecturer_payload = None
                if assignment and assignment.lecturer_id:
                    lecturer_payload = {
                        "lecturer_user_id": assignment.lecturer.user_id,
                        "lecturer_name": assignment.lecturer.user.display_name
                        or assignment.lecturer.user.username,
                    }
                courses.append(
                    {
                        "unit_id": info["unit_id"],
                        "unit_code": info["unit_code"],
                        "unit_title": info["unit_title"],
                        "lecturer": lecturer_payload,
                        "student_count": len(info["students"]),
                        "students": info["students"],
                    }
                )
            years_payload.append({"study_year": study_year, "courses": courses})

        offerings_payload = []
        for offering in offering_qs:
            assignment = lecturer_map.get(offering.unit_id)
            offerings_payload.append(
                {
                    "term_offering_id": offering.id,
                    "programme_id": offering.programme_id,
                    "programme_name": offering.programme.name if offering.programme_id else "",
                    "unit_id": offering.unit_id,
                    "unit_code": offering.unit.code if offering.unit_id else "",
                    "unit_title": offering.unit.title if offering.unit_id else "",
                    "trimester": offering.trimester,
                    "capacity": offering.capacity,
                    "lecturer_user_id": assignment.lecturer.user_id
                    if assignment and assignment.lecturer_id
                    else None,
                    "lecturer_name": assignment.lecturer.user.display_name
                    if assignment and assignment.lecturer_id
                    else None,
                }
            )

        return Response(
            {
                "department": {
                    "id": department.id,
                    "name": department.name,
                    "code": department.code,
                },
                "academic_year": academic_year,
                "trimester": int(trimester) if trimester else None,
                "years": years_payload,
                "offerings": offerings_payload,
            }
        )

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
