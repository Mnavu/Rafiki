from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from ..models import Programme, CurriculumUnit, TermOffering, LecturerAssignment, Timetable
from ..serializers import ProgrammeSerializer, CurriculumUnitSerializer, TermOfferingSerializer, LecturerAssignmentSerializer, TimetableSerializer
from users.models import User


CATALOGUE_MANAGER_ROLES = {
    User.Roles.HOD,
    User.Roles.ADMIN,
    User.Roles.RECORDS,
    User.Roles.SUPERADMIN,
}


def _require_catalogue_manager(user):
    if not user.is_authenticated:
        raise PermissionDenied("Authentication required.")
    if user.is_staff or user.is_superuser:
        return
    if user.role not in CATALOGUE_MANAGER_ROLES:
        raise PermissionDenied("Only HOD, records, or admin roles can manage catalogue settings.")


def _validate_hod_scope(user, department_id):
    if user.role != User.Roles.HOD:
        return
    if not hasattr(user, "hod_profile") or not user.hod_profile.department_id:
        raise PermissionDenied("HOD profile must be mapped to a department.")
    if user.hod_profile.department_id != department_id:
        raise PermissionDenied("HOD can only manage catalogue data for their department.")


class ProgrammeViewSet(viewsets.ModelViewSet):
    queryset = Programme.objects.all()
    serializer_class = ProgrammeSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['department']

    def get_queryset(self):
        qs = Programme.objects.all()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        if user.role == User.Roles.HOD and hasattr(user, "hod_profile") and user.hod_profile.department_id:
            return qs.filter(department_id=user.hod_profile.department_id)
        return qs

    def perform_create(self, serializer):
        _require_catalogue_manager(self.request.user)
        department_id = serializer.validated_data.get("department_id")
        if department_id is None:
            raise ValidationError("department is required.")
        _validate_hod_scope(self.request.user, department_id)
        serializer.save()

    def perform_update(self, serializer):
        _require_catalogue_manager(self.request.user)
        department_id = serializer.validated_data.get("department_id", serializer.instance.department_id)
        _validate_hod_scope(self.request.user, department_id)
        serializer.save()

    @action(detail=True, methods=['get'])
    def curriculum(self, request, pk=None):
        programme = self.get_object()
        curriculum = CurriculumUnit.objects.filter(programme=programme)
        serializer = CurriculumUnitSerializer(curriculum, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def upsert_curriculum(self, request, pk=None):
        _require_catalogue_manager(request.user)
        programme = self.get_object()
        _validate_hod_scope(request.user, programme.department_id)
        units = request.data.get("units", [])
        if not isinstance(units, list) or not units:
            raise ValidationError("Provide a non-empty 'units' list.")

        upserted = []
        for index, unit_payload in enumerate(units):
            if not isinstance(unit_payload, dict):
                raise ValidationError(f"units[{index}] must be an object.")
            code = (unit_payload.get("code") or "").strip().upper()
            title = (unit_payload.get("title") or "").strip()
            if not code or not title:
                raise ValidationError(f"units[{index}] requires both code and title.")
            defaults = {
                "programme": programme,
                "title": title,
                "credit_hours": unit_payload.get("credit_hours", 3),
                "trimester_hint": unit_payload.get("trimester_hint"),
                "has_prereq": bool(unit_payload.get("has_prereq", False)),
            }
            prereq_id = unit_payload.get("prereq_unit")
            if prereq_id:
                defaults["prereq_unit_id"] = prereq_id
            unit, _ = CurriculumUnit.objects.update_or_create(code=code, defaults=defaults)
            upserted.append(unit)

        return Response(CurriculumUnitSerializer(upserted, many=True).data)


class CurriculumUnitViewSet(viewsets.ModelViewSet):
    queryset = CurriculumUnit.objects.select_related("programme", "programme__department")
    serializer_class = CurriculumUnitSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['programme', 'trimester_hint']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        if user.role == User.Roles.HOD and hasattr(user, "hod_profile") and user.hod_profile.department_id:
            return qs.filter(programme__department_id=user.hod_profile.department_id)
        return qs.none()

    def perform_create(self, serializer):
        _require_catalogue_manager(self.request.user)
        programme = serializer.validated_data.get("programme")
        if not programme:
            raise ValidationError("programme is required.")
        _validate_hod_scope(self.request.user, programme.department_id)
        serializer.save()

    def perform_update(self, serializer):
        _require_catalogue_manager(self.request.user)
        programme = serializer.validated_data.get("programme", serializer.instance.programme)
        if not programme:
            raise ValidationError("programme is required.")
        _validate_hod_scope(self.request.user, programme.department_id)
        serializer.save()


class TermOfferingViewSet(viewsets.ModelViewSet):
    queryset = TermOffering.objects.select_related("programme", "programme__department", "unit")
    serializer_class = TermOfferingSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['programme', 'academic_year', 'trimester']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        if user.role == User.Roles.HOD and hasattr(user, "hod_profile") and user.hod_profile.department_id:
            return qs.filter(programme__department_id=user.hod_profile.department_id)
        if user.role in {User.Roles.LECTURER, User.Roles.STUDENT, User.Roles.PARENT}:
            return qs.filter(offered=True)
        return qs.none()

    def perform_create(self, serializer):
        _require_catalogue_manager(self.request.user)
        programme = serializer.validated_data.get("programme")
        if not programme:
            raise ValidationError("programme is required.")
        _validate_hod_scope(self.request.user, programme.department_id)
        serializer.save()

    def perform_update(self, serializer):
        _require_catalogue_manager(self.request.user)
        programme = serializer.validated_data.get("programme", serializer.instance.programme)
        if not programme:
            raise ValidationError("programme is required.")
        _validate_hod_scope(self.request.user, programme.department_id)
        serializer.save()


class LecturerAssignmentViewSet(viewsets.ModelViewSet):
    queryset = LecturerAssignment.objects.select_related(
        "lecturer",
        "lecturer__user",
        "lecturer__department",
        "unit",
        "unit__programme",
        "unit__programme__department",
    )
    serializer_class = LecturerAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        if user.role == User.Roles.LECTURER:
            if hasattr(user, "lecturer_profile"):
                return qs.filter(lecturer=user.lecturer_profile)
            return qs.none()
        if user.role == User.Roles.HOD and hasattr(user, "hod_profile") and user.hod_profile.department_id:
            return qs.filter(unit__programme__department_id=user.hod_profile.department_id)
        if user.role in {User.Roles.ADMIN, User.Roles.RECORDS}:
            return qs
        return qs.none()

    def perform_create(self, serializer):
        _require_catalogue_manager(self.request.user)
        unit = serializer.validated_data.get("unit")
        if not unit or not unit.programme_id:
            raise ValidationError("Assigned unit must belong to a programme.")
        _validate_hod_scope(self.request.user, unit.programme.department_id)
        serializer.save()

    def perform_update(self, serializer):
        _require_catalogue_manager(self.request.user)
        unit = serializer.validated_data.get("unit", serializer.instance.unit)
        if not unit or not unit.programme_id:
            raise ValidationError("Assigned unit must belong to a programme.")
        _validate_hod_scope(self.request.user, unit.programme.department_id)
        serializer.save()


class TimetableViewSet(viewsets.ModelViewSet):
    queryset = Timetable.objects.select_related("programme", "programme__department", "unit", "lecturer")
    serializer_class = TimetableSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['programme', 'lecturer']

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return qs
        if user.role == User.Roles.HOD and hasattr(user, "hod_profile") and user.hod_profile.department_id:
            return qs.filter(programme__department_id=user.hod_profile.department_id)
        return qs

    def perform_create(self, serializer):
        _require_catalogue_manager(self.request.user)
        programme = serializer.validated_data.get("programme")
        if not programme:
            raise ValidationError("programme is required.")
        _validate_hod_scope(self.request.user, programme.department_id)
        serializer.save()

    def perform_update(self, serializer):
        _require_catalogue_manager(self.request.user)
        programme = serializer.validated_data.get("programme", serializer.instance.programme)
        if not programme:
            raise ValidationError("programme is required.")
        _validate_hod_scope(self.request.user, programme.department_id)
        serializer.save()
