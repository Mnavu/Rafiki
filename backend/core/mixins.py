from django.core.exceptions import FieldError

from learning.models import LecturerAssignment, Registration
from users.models import ParentStudentLink


def _linked_student_profile_ids(user):
    return list(
        ParentStudentLink.objects.filter(parent__user=user).values_list("student_id", flat=True)
    )


def _linked_student_user_ids(user):
    return list(
        ParentStudentLink.objects.filter(parent__user=user).values_list("student__user_id", flat=True)
    )


def _lecturer_unit_ids(user):
    return list(
        LecturerAssignment.objects.filter(lecturer__user=user).values_list("unit_id", flat=True)
    )


def _model_has_field(model, field_name: str) -> bool:
    return hasattr(model, "_meta") and any(f.name == field_name for f in model._meta.get_fields())


def scope_queryset_to_user(user, qs, *, view=None):
    """
    Restrict a queryset to data the given user should be able to access.
    Falls back to the original queryset when no rule applies to avoid hard failures
    while the granular rules are being adopted app-by-app.
    """
    if not getattr(user, "is_authenticated", False):
        return qs.none()

    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return qs

    role = getattr(user, "role", None)
    if not role:
        return qs.none()

    model_name = getattr(getattr(qs, "model", None), "_meta", None)
    model_label = model_name.model_name if model_name else ""
    filtered_qs = None

    try:
        if model_label == "notification":
            filtered_qs = qs.filter(user_id=user.id)

        elif model_label == "feeitem":
            if role == "student":
                filtered_qs = qs.filter(student_id=user.id)
            elif role == "parent":
                student_ids = _linked_student_user_ids(user)
                filtered_qs = qs.filter(student_id__in=student_ids) if student_ids else qs.none()
            elif role in {"finance", "records", "admin"}:
                filtered_qs = qs
            else:
                filtered_qs = qs.none()

        elif model_label == "payment":
            if role == "student":
                filtered_qs = qs.filter(student__user=user)
            elif role == "parent":
                student_ids = [s.pk for s in user.guardian_profile.linked_students.all()]
                filtered_qs = qs.filter(student_id__in=student_ids) if student_ids else qs.none()
            elif role in {"finance", "records", "admin"}:
                filtered_qs = qs
            else:
                filtered_qs = qs.none()

        elif model_label == "assignment":
            if role == "student":
                registered_units = Registration.objects.filter(
                    student__user=user,
                    status="approved",
                ).values_list("unit_id", flat=True)
                filtered_qs = qs.filter(unit_id__in=registered_units).distinct()
            elif role == "parent":
                student_ids = _linked_student_profile_ids(user)
                registered_units = Registration.objects.filter(
                    student_id__in=student_ids,
                    status=Registration.Status.APPROVED,
                ).values_list("unit_id", flat=True)
                filtered_qs = qs.filter(unit_id__in=registered_units).distinct()
            elif role == "lecturer":
                assigned_units = _lecturer_unit_ids(user)
                filtered_qs = qs.filter(unit_id__in=assigned_units).distinct()
            elif role == "hod":
                dept_id = getattr(getattr(user, "hod_profile", None), "department_id", None)
                if dept_id:
                    filtered_qs = qs.filter(unit__programme__department_id=dept_id)
            elif role in {"admin", "records"}:
                filtered_qs = qs
            else:
                filtered_qs = qs.none()

        elif model_label == "registration":
            if role == "student":
                filtered_qs = qs.filter(student__user=user)
            elif role == "parent":
                student_ids = _linked_student_profile_ids(user)
                filtered_qs = qs.filter(student_id__in=student_ids) if student_ids else qs.none()
            elif role == "lecturer":
                assigned_units = _lecturer_unit_ids(user)
                filtered_qs = qs.filter(unit_id__in=assigned_units).distinct()
            elif role == "hod":
                department_id = getattr(getattr(user, "hod_profile", None), "department_id", None)
                if department_id:
                    filtered_qs = qs.filter(unit__programme__department_id=department_id)
            elif role in {"admin", "records", "finance"}:
                filtered_qs = qs
            else:
                filtered_qs = qs.none()

        elif model_label == "submission":
            if role == "student":
                filtered_qs = qs.filter(student__user=user)
            elif role == "parent":
                student_ids = _linked_student_profile_ids(user)
                filtered_qs = qs.filter(student_id__in=student_ids) if student_ids else qs.none()
            elif role == "lecturer":
                assigned_units = _lecturer_unit_ids(user)
                filtered_qs = qs.filter(
                    assignment__unit_id__in=assigned_units,
                ).distinct()
            elif role == "hod":
                department_id = getattr(getattr(user, "hod_profile", None), "department_id", None)
                if department_id:
                    filtered_qs = qs.filter(
                        assignment__unit__programme__department_id=department_id
                    )
            elif role in {"admin", "records"}:
                filtered_qs = qs
            else:
                filtered_qs = qs.none()

        elif model_label == "timetable":
            if role == "student":
                programme_id = getattr(getattr(user, "student_profile", None), "programme_id", None)
                filtered_qs = qs.filter(programme_id=programme_id) if programme_id else qs.none()
            elif role == "parent":
                programme_ids = list(
                    ParentStudentLink.objects.filter(parent__user=user).values_list(
                        "student__programme_id",
                        flat=True,
                    )
                )
                filtered_qs = qs.filter(programme_id__in=programme_ids).distinct() if programme_ids else qs.none()
            elif role == "lecturer":
                try:
                    filtered_qs = qs.filter(lecturer=user.lecturer_profile)
                except Exception:
                    filtered_qs = qs.none()
            elif role == "hod":
                department_id = getattr(getattr(user, "hod_profile", None), "department_id", None)
                if department_id:
                    filtered_qs = qs.filter(programme__department_id=department_id)
            elif role in {"admin", "records"}:
                filtered_qs = qs
            else:
                filtered_qs = qs.none()
    except FieldError:
        filtered_qs = qs.none()

    if filtered_qs is None and _model_has_field(qs.model, "owner_user"):
        filtered_qs = qs.filter(owner_user=user)
    elif filtered_qs is None and _model_has_field(qs.model, "owner_user_id"):
        filtered_qs = qs.filter(owner_user_id=user.id)

    return filtered_qs if filtered_qs is not None else qs


class ScopedListMixin:
    """
    Apply per-user scoping to list endpoints. Combine with object-level permissions.
    """

    def get_queryset(self):
        qs = super().get_queryset()
        return scope_queryset_to_user(self.request.user, qs, view=self)

    def perform_create(self, serializer):
        owner_field = None
        if "owner_user" in serializer.fields and not serializer.validated_data.get("owner_user"):
            owner_field = "owner_user"
        elif "owner_user_id" in serializer.fields and not serializer.validated_data.get("owner_user_id"):
            owner_field = "owner_user_id"

        if owner_field == "owner_user":
            serializer.save(owner_user=self.request.user)
        elif owner_field == "owner_user_id":
            serializer.save(owner_user_id=self.request.user.id)
        else:
            serializer.save()
