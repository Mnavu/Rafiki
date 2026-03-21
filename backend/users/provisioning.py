from __future__ import annotations

from typing import Tuple

from django.db import transaction
from django.utils import timezone
from django.utils.crypto import get_random_string

from core.models import AuditLog
from finance.models import FinanceStatus

from .models import (
    Admin,
    FamilyEnrollmentIntent,
    FinanceOfficer,
    Guardian,
    HOD,
    Lecturer,
    ParentStudentLink,
    RecordsOfficer,
    Student,
    User,
    UserProvisionRequest,
)
from .notifications import notify_provision_request_approval


STAFF_ROLES = {
    User.Roles.ADMIN,
    User.Roles.SUPERADMIN,
    User.Roles.HOD,
    User.Roles.RECORDS,
    User.Roles.FINANCE,
}


def _record_admin_audit(
    *,
    actor: User | None,
    action: str,
    target_table: str,
    target_id: str,
    before: dict | None = None,
    after: dict | None = None,
) -> None:
    AuditLog.objects.create(
        actor_user=actor,
        action=action,
        target_table=target_table,
        target_id=target_id,
        before=before or {},
        after=after or {},
    )


def _find_family_intent(
    provision_request: UserProvisionRequest,
) -> tuple[FamilyEnrollmentIntent | None, str | None]:
    intent = (
        FamilyEnrollmentIntent.objects.select_related(
            "student_request",
            "parent_request",
            "student_request__created_user",
            "parent_request__created_user",
            "programme",
        )
        .filter(student_request=provision_request)
        .first()
    )
    if intent is not None:
        return intent, "student"

    intent = (
        FamilyEnrollmentIntent.objects.select_related(
            "student_request",
            "parent_request",
            "student_request__created_user",
            "parent_request__created_user",
            "programme",
        )
        .filter(parent_request=provision_request)
        .first()
    )
    if intent is not None:
        return intent, "parent"
    return None, None


def _ensure_role_profile(
    user: User,
    *,
    role: str,
    intent: FamilyEnrollmentIntent | None = None,
) -> None:
    if role == User.Roles.STUDENT:
        defaults = {
            "programme": intent.programme if intent else None,
            "year": intent.year if intent and intent.year else 1,
            "trimester": intent.trimester if intent and intent.trimester else 1,
            "trimester_label": (
                intent.trimester_label
                if intent and intent.trimester_label
                else f"Year {intent.year if intent and intent.year else 1}, Trimester {intent.trimester if intent and intent.trimester else 1}"
            ),
            "current_status": Student.Status.ADMITTED,
        }
        student, created = Student.objects.get_or_create(user=user, defaults=defaults)
        if not created:
            updated_fields: list[str] = []
            if intent and student.programme_id != intent.programme_id:
                student.programme = intent.programme
                updated_fields.append("programme")
            if intent and intent.year and student.year != intent.year:
                student.year = intent.year
                updated_fields.append("year")
            if intent and intent.trimester and student.trimester != intent.trimester:
                student.trimester = intent.trimester
                updated_fields.append("trimester")
            if intent and intent.trimester_label and student.trimester_label != intent.trimester_label:
                student.trimester_label = intent.trimester_label
                updated_fields.append("trimester_label")
            if student.current_status == Student.Status.NEW:
                student.current_status = Student.Status.ADMITTED
                updated_fields.append("current_status")
            if updated_fields:
                student.save(update_fields=updated_fields)
        return

    if role == User.Roles.PARENT:
        Guardian.objects.get_or_create(user=user)
        return
    if role == User.Roles.LECTURER:
        Lecturer.objects.get_or_create(user=user)
        return
    if role == User.Roles.HOD:
        HOD.objects.get_or_create(user=user)
        return
    if role in {User.Roles.ADMIN, User.Roles.SUPERADMIN}:
        Admin.objects.get_or_create(user=user)
        return
    if role == User.Roles.RECORDS:
        RecordsOfficer.objects.get_or_create(user=user)
        return
    if role == User.Roles.FINANCE:
        FinanceOfficer.objects.get_or_create(user=user)


def finalize_family_enrollment(
    intent: FamilyEnrollmentIntent | None,
) -> FamilyEnrollmentIntent | None:
    if intent is None or not intent.student_request_id:
        return intent

    student_user = intent.student_request.created_user
    parent_user = intent.parent_request.created_user if intent.parent_request_id else None

    if not student_user:
        return intent
    if intent.parent_request_id and not parent_user:
        return intent

    student_updates: list[str] = []
    if intent.student_first_name and student_user.first_name != intent.student_first_name:
        student_user.first_name = intent.student_first_name
        student_updates.append("first_name")
    if intent.student_last_name and student_user.last_name != intent.student_last_name:
        student_user.last_name = intent.student_last_name
        student_updates.append("last_name")
    student_display_name = (
        student_user.display_name
        or f"{intent.student_first_name} {intent.student_last_name}".strip()
        or student_user.username
    )
    if student_user.display_name != student_display_name:
        student_user.display_name = student_display_name
        student_updates.append("display_name")
    if student_updates:
        student_user.save(update_fields=list(set(student_updates)))

    if parent_user:
        parent_updates: list[str] = []
        if intent.parent_first_name and parent_user.first_name != intent.parent_first_name:
            parent_user.first_name = intent.parent_first_name
            parent_updates.append("first_name")
        if intent.parent_last_name and parent_user.last_name != intent.parent_last_name:
            parent_user.last_name = intent.parent_last_name
            parent_updates.append("last_name")
        parent_display_name = (
            parent_user.display_name
            or f"{intent.parent_first_name} {intent.parent_last_name}".strip()
            or parent_user.username
        )
        if parent_user.display_name != parent_display_name:
            parent_user.display_name = parent_display_name
            parent_updates.append("display_name")
        if parent_updates:
            parent_user.save(update_fields=list(set(parent_updates)))

        guardian_profile, _ = Guardian.objects.get_or_create(user=parent_user)
        student_profile = student_user.student_profile
        link, created = ParentStudentLink.objects.get_or_create(
            parent=guardian_profile,
            student=student_profile,
            defaults={"relationship": intent.relationship},
        )
        if not created and intent.relationship and link.relationship != intent.relationship:
            link.relationship = intent.relationship
            link.save(update_fields=["relationship"])

    if intent.fee_amount:
        student_profile = student_user.student_profile
        finance_status, _ = FinanceStatus.objects.get_or_create(
            student=student_profile,
            academic_year=student_profile.year,
            trimester=student_profile.trimester,
            defaults={
                "total_due": intent.fee_amount,
                "total_paid": 0,
                "status": FinanceStatus.Status.PENDING,
                "clearance_status": FinanceStatus.Clearance.BLOCKED,
            },
        )
        if finance_status.total_due != intent.fee_amount:
            finance_status.total_due = intent.fee_amount
            finance_status.save(update_fields=["total_due", "updated_at"])

    intent.delete()
    return None


@transaction.atomic
def approve_provision_request(
    provision_request: UserProvisionRequest,
    *,
    acting: User | None,
) -> Tuple[User, str]:
    if provision_request.status != UserProvisionRequest.Status.PENDING:
        raise ValueError("Request has already been processed.")

    existing_qs = User.objects.filter(username__iexact=provision_request.username)
    if provision_request.created_user_id:
        existing_qs = existing_qs.exclude(pk=provision_request.created_user_id)
    if existing_qs.exists():
        raise ValueError("A user with this username already exists.")

    intent, intent_role = _find_family_intent(provision_request)
    desired_password = None
    if intent is not None:
        desired_password = (
            intent.student_password if intent_role == "student" else intent.parent_password
        ) or None

    temporary_password = desired_password or get_random_string(length=12)
    role = provision_request.role
    user = User(
        username=provision_request.username,
        email=provision_request.email,
        display_name=provision_request.display_name or provision_request.username,
        role=role,
        is_staff=role in STAFF_ROLES,
        is_superuser=role == User.Roles.SUPERADMIN,
        must_change_password=not bool(desired_password),
    )
    user.set_password(temporary_password)
    user.save()

    _ensure_role_profile(user, role=role, intent=intent)

    provision_request.status = UserProvisionRequest.Status.APPROVED
    provision_request.reviewed_by = acting
    provision_request.reviewed_at = timezone.now()
    provision_request.created_user = user
    provision_request.rejection_reason = ""
    provision_request.temporary_password = temporary_password
    provision_request.save(
        update_fields=[
            "status",
            "reviewed_by",
            "reviewed_at",
            "created_user",
            "rejection_reason",
            "temporary_password",
        ]
    )

    _record_admin_audit(
        actor=acting,
        action="user_provision_approved",
        target_table=UserProvisionRequest._meta.label,
        target_id=str(provision_request.pk),
        after={"username": provision_request.username, "role": provision_request.role},
    )

    notify_provision_request_approval(provision_request, temporary_password)
    finalize_family_enrollment(intent)
    return user, temporary_password


@transaction.atomic
def reject_provision_request(
    provision_request: UserProvisionRequest,
    *,
    acting: User | None,
    reason: str = "",
) -> UserProvisionRequest:
    if provision_request.status != UserProvisionRequest.Status.PENDING:
        raise ValueError("Request has already been processed.")

    provision_request.status = UserProvisionRequest.Status.REJECTED
    provision_request.reviewed_by = acting
    provision_request.reviewed_at = timezone.now()
    provision_request.rejection_reason = reason
    provision_request.save(
        update_fields=["status", "reviewed_by", "reviewed_at", "rejection_reason"]
    )

    _record_admin_audit(
        actor=acting,
        action="user_provision_rejected",
        target_table=UserProvisionRequest._meta.label,
        target_id=str(provision_request.pk),
        after={"reason": reason},
    )
    return provision_request


def resend_provision_credentials(
    provision_request: UserProvisionRequest,
) -> None:
    if (
        provision_request.status != UserProvisionRequest.Status.APPROVED
        or not provision_request.temporary_password
    ):
        raise ValueError("Only approved requests with stored credentials can be resent.")
    notify_provision_request_approval(
        provision_request,
        provision_request.temporary_password,
    )


@transaction.atomic
def admin_reset_password(
    *,
    target: User,
    acting: User | None,
    new_password: str | None = None,
) -> str:
    if (
        acting
        and acting.role == User.Roles.ADMIN
        and target.role == User.Roles.SUPERADMIN
        and not acting.is_superuser
    ):
        raise PermissionError("Admins cannot reset super admin passwords.")

    temporary_password = (new_password or "").strip() or get_random_string(length=12)
    if len(temporary_password) < 6:
        raise ValueError("Temporary password must be at least 6 characters.")

    target.set_password(temporary_password)
    target.must_change_password = True
    target._password_changed_by = acting
    target.save(update_fields=["password", "must_change_password"])

    _record_admin_audit(
        actor=acting,
        action="admin_password_reset",
        target_table=User._meta.label,
        target_id=str(target.pk),
        after={
            "username": target.username,
            "role": target.role,
            "must_change_password": True,
        },
    )
    return temporary_password
