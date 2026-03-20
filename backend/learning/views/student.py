from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.generics import ListAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied, ValidationError

from users.models import Student, User
from users.display import resolve_user_display_name
from users.serializers import UserSerializer
from ..models import Registration, CurriculumUnit, TermOffering
from ..serializers import RegistrationSerializer
from ..workflows import (
    COMMUNITY_ELIGIBLE_REGISTRATION_STATUSES,
    ensure_registration_channels,
)

PEER_ELIGIBLE_REGISTRATION_STATUSES = (
    Registration.Status.SUBMITTED,
    Registration.Status.PENDING_HOD,
    Registration.Status.APPROVED,
)
MAX_STUDENT_TERM_UNITS = 4
UNIT_SELECTION_ALLOWED_STATUSES = {
    Student.Status.FINANCE_OK,
    Student.Status.PENDING_HOD,
    Student.Status.ACTIVE,
}


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

        if student_profile.current_status not in UNIT_SELECTION_ALLOWED_STATUSES:
            raise PermissionDenied(
                f"Fee clearance required before unit selection. Your status is {student_profile.current_status}"
            )

        unit_ids = request.data.get('unit_ids', [])
        if not isinstance(unit_ids, list) or not unit_ids:
            raise ValidationError("Please provide a list of unit_ids.")

        requested_unit_ids = []
        seen_unit_ids = set()
        for unit_id in unit_ids:
            try:
                parsed_unit_id = int(unit_id)
            except (TypeError, ValueError):
                raise ValidationError("One or more unit IDs are invalid.")
            if parsed_unit_id in seen_unit_ids:
                continue
            seen_unit_ids.add(parsed_unit_id)
            requested_unit_ids.append(parsed_unit_id)

        if len(requested_unit_ids) > MAX_STUDENT_TERM_UNITS:
            raise ValidationError(f"You can register a maximum of {MAX_STUDENT_TERM_UNITS} units.")

        units = list(
            CurriculumUnit.objects.filter(
                id__in=requested_unit_ids,
                programme=student_profile.programme,
            ).select_related("programme")
        )
        if len(units) != len(requested_unit_ids):
            raise ValidationError("One or more unit IDs are invalid for this student's programme.")
        units_by_id = {unit.id: unit for unit in units}

        academic_year = (
            TermOffering.objects.filter(
                programme=student_profile.programme,
                unit_id__in=requested_unit_ids,
                trimester=student_profile.trimester,
                offered=True,
            )
            .order_by("-academic_year")
            .values_list("academic_year", flat=True)
            .first()
            or timezone.now().year
        )
        trimester = student_profile.trimester

        current_term_registrations = Registration.objects.filter(
            student=student_profile,
            academic_year=academic_year,
            trimester=trimester,
        )
        approved_unit_ids = set(
            current_term_registrations.filter(status=Registration.Status.APPROVED).values_list("unit_id", flat=True)
        )
        if len(approved_unit_ids.union(requested_unit_ids)) > MAX_STUDENT_TERM_UNITS:
            raise ValidationError(
                f"This term already has approved units. You can only hold {MAX_STUDENT_TERM_UNITS} total units."
            )

        mutable_statuses = (
            Registration.Status.DRAFT,
            Registration.Status.SUBMITTED,
            Registration.Status.PENDING_HOD,
            Registration.Status.REJECTED,
        )
        current_term_registrations.filter(status__in=mutable_statuses).exclude(
            unit_id__in=requested_unit_ids
        ).delete()

        registrations = []
        for unit_id in requested_unit_ids:
            unit = units_by_id[unit_id]
            reg, created = Registration.objects.get_or_create(
                student=student_profile,
                unit=unit,
                academic_year=academic_year,
                trimester=trimester,
                defaults={'status': Registration.Status.PENDING_HOD}
            )
            if reg.status != Registration.Status.APPROVED:
                reg.status = Registration.Status.PENDING_HOD
                reg.approved_by = None
                reg.approved_at = None
                reg.save(update_fields=['status', 'approved_by', 'approved_at'])
            ensure_registration_channels(reg)
            registrations.append(reg)

        if any(reg.status == Registration.Status.PENDING_HOD for reg in registrations):
            next_status = Student.Status.PENDING_HOD
        elif current_term_registrations.filter(status=Registration.Status.APPROVED).exists():
            next_status = Student.Status.ACTIVE
        else:
            next_status = Student.Status.FINANCE_OK
        if student_profile.current_status != next_status:
            student_profile.current_status = next_status
            student_profile.save(update_fields=["current_status"])
        
        serializer = RegistrationSerializer(registrations, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class StudentLecturersView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role != 'student':
            return User.objects.none()
        
        try:
            student_profile = user.student_profile
        except Student.DoesNotExist:
            return User.objects.none()

        accessible_registrations = Registration.objects.filter(
            student=student_profile,
            status__in=COMMUNITY_ELIGIBLE_REGISTRATION_STATUSES,
        )
        unit_ids = accessible_registrations.values_list('unit_id', flat=True)
        
        from learning.models import LecturerAssignment
        lecturer_ids = (
            LecturerAssignment.objects.filter(unit_id__in=unit_ids)
            .values_list('lecturer_id', flat=True)
            .distinct()
        )
        
        return User.objects.filter(lecturer_profile__id__in=lecturer_ids).distinct()


class StudentPeersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != User.Roles.STUDENT:
            raise PermissionDenied("Only students can view peers.")
        try:
            student_profile = user.student_profile
        except Student.DoesNotExist:
            return Response([])

        approved_regs = Registration.objects.filter(
            student=student_profile,
            status__in=PEER_ELIGIBLE_REGISTRATION_STATUSES,
        )
        unit_ids = list(approved_regs.values_list("unit_id", flat=True))
        if not unit_ids:
            return Response([])

        peer_regs = (
            Registration.objects.filter(
                unit_id__in=unit_ids,
                status__in=PEER_ELIGIBLE_REGISTRATION_STATUSES,
            )
            .exclude(student=student_profile)
            .select_related("student__user", "unit")
        )

        peers = {}
        for reg in peer_regs:
            peer_student = reg.student
            peer_user = peer_student.user
            entry = peers.setdefault(
                peer_user.id,
                {
                    "user_id": peer_user.id,
                    "username": peer_user.username,
                    "display_name": resolve_user_display_name(peer_user),
                    "year": peer_student.year,
                    "shared_units": [],
                },
            )
            if reg.unit.code not in entry["shared_units"]:
                entry["shared_units"].append(reg.unit.code)

        return Response(sorted(peers.values(), key=lambda item: item["display_name"].lower()))
