from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from core.models import AuditLog, ApprovalRequest
# from finance.models import FeeItem
# from learning.models import Course, Enrollment

from finance.models import Payment
from learning.models import Registration, CurriculumUnit
from ..models import User, ParentStudentLink, UserProvisionRequest
from ..provisioning import (
    admin_reset_password as apply_admin_password_reset,
    approve_provision_request,
    reject_provision_request,
)
from ..role_assignment import apply_user_role, SENSITIVE_ROLES
from ..serializers import (
    UserSerializer,
    SelfProfileUpdateSerializer,
    AdminUserCreateSerializer,
    ParentStudentLinkSerializer,
    UserProvisionSerializer,
    UserProvisionRequestSerializer,
    FamilyEnrollmentSerializer,
)


class UserViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.all().order_by("id")
        role_filter = self.request.query_params.get("role")
        if role_filter:
            qs = qs.filter(role=role_filter)

        if user.is_superuser or user.is_staff:
            return qs
        if user.role in {User.Roles.ADMIN, User.Roles.SUPERADMIN, User.Roles.RECORDS, User.Roles.HOD}:
            return qs
        return qs.filter(pk=user.pk)


class ParentStudentLinkViewSet(viewsets.ModelViewSet):
    serializer_class = ParentStudentLinkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = ParentStudentLink.objects.select_related("parent", "student")
        if user.role == User.Roles.PARENT:
            return qs.filter(parent__user=user)
        if user.role == User.Roles.STUDENT:
            return qs.filter(student__user=user)
        if user.role in [User.Roles.ADMIN, User.Roles.SUPERADMIN, User.Roles.HOD, User.Roles.RECORDS] or user.is_staff:
            return qs
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in [User.Roles.ADMIN, User.Roles.SUPERADMIN, User.Roles.HOD, User.Roles.RECORDS] and not user.is_staff:
            raise PermissionDenied("Only admin, HOD, or records staff can create parent links.")
        # Admin/superadmin can link directly without records passcode.
        if user.role not in [User.Roles.ADMIN, User.Roles.SUPERADMIN]:
            passcode = self.request.data.get("records_passcode")
            if passcode != settings.RECORDS_PROVISION_PASSCODE:
                raise PermissionDenied("Invalid records approval passcode.")
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role not in [User.Roles.ADMIN, User.Roles.SUPERADMIN, User.Roles.HOD, User.Roles.RECORDS] and not user.is_staff:
            raise PermissionDenied("Only admin, HOD, or records staff can delete parent links.")
        instance.delete()


class UserProvisionRequestViewSet(viewsets.ModelViewSet):
    serializer_class = UserProvisionRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        allowed_roles = {User.Roles.RECORDS, User.Roles.ADMIN, User.Roles.HOD}
        qs = UserProvisionRequest.objects.select_related(
            "requested_by", "reviewed_by", "created_user"
        )
        if user.role in allowed_roles or user.is_staff:
            return qs
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        allowed_roles = {User.Roles.RECORDS, User.Roles.ADMIN, User.Roles.HOD}
        if user.role not in allowed_roles and not user.is_staff:
            raise PermissionDenied("Only admin, HOD, or records staff can submit provisioning requests.")
        serializer.save(requested_by=user)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        provision_request = self.get_object()
        acting = request.user
        if acting.role not in {User.Roles.ADMIN, User.Roles.HOD} and not acting.is_staff:
            raise PermissionDenied("Only admin or HOD users may approve requests.")
        try:
            user, temp_password = approve_provision_request(provision_request, acting=acting)
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)})
        return Response(
            {
                "user": UserSerializer(user).data,
                "temporary_password": temp_password,
            }
        )

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def reject(self, request, pk=None):
        provision_request = self.get_object()
        acting = request.user
        if acting.role not in {User.Roles.ADMIN, User.Roles.HOD} and not acting.is_staff:
            raise PermissionDenied("Only admin or HOD users may reject requests.")
        reason = request.data.get("reason", "").strip()
        try:
            reject_provision_request(provision_request, acting=acting, reason=reason)
        except ValueError as exc:
            raise ValidationError({"detail": str(exc)})
        return Response(UserProvisionRequestSerializer(provision_request).data)

    @action(detail=True, methods=["post"], permission_classes=[permissions.IsAuthenticated])
    def email_again(self, request, pk=None):
        provision_request = self.get_object()
        acting = request.user
        if acting.role not in {User.Roles.ADMIN, User.Roles.HOD} and not acting.is_staff:
            raise PermissionDenied("Only admin or HOD users may resend credentials.")
        if provision_request.status != UserProvisionRequest.Status.APPROVED or not provision_request.temporary_password:
            raise ValidationError({"detail": "Only approved requests with recorded credentials can be resent."})
        notify_provision_request_approval(provision_request, provision_request.temporary_password)
        return Response({"detail": "Credentials re-sent to the requester."})


@api_view(["GET", "PATCH"])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    """Return or update the current authenticated user's profile."""
    user = request.user
    if request.method == "GET":
        return Response(UserSerializer(user).data)

    serializer = SelfProfileUpdateSerializer(user, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    before = {
        "username": user.username,
        "display_name": user.display_name,
    }
    serializer.save()
    user.refresh_from_db()
    AuditLog.objects.create(
        actor_user=user,
        action="profile_identity_updated",
        target_table=User._meta.label,
        target_id=str(user.pk),
        before=before,
        after={
            "username": user.username,
            "display_name": user.display_name,
        },
    )
    return Response(UserSerializer(user).data)


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_request(request):
    identifier = request.data.get("username") or request.data.get("email")
    if not identifier:
        return Response({"detail": "username or email is required."}, status=status.HTTP_400_BAD_REQUEST)

    user = None
    if identifier:
        try:
            user = User.objects.get(username=identifier)
        except User.DoesNotExist:
            try:
                user = User.objects.get(email__iexact=identifier)
            except User.DoesNotExist:
                user = None

    if user:
        token = default_token_generator.make_token(user)
        user.must_change_password = True
        actor = request.user if getattr(request, "user", None) and request.user.is_authenticated else None
        user._password_changed_by = actor or user
        user.save(update_fields=["must_change_password"])
        AuditLog.objects.create(
            actor_user=actor if actor else None,
            action="password_reset_request",
            target_table=User._meta.label,
            target_id=str(user.pk),
            after={"token_issued": True},
        )
        return Response({
            "detail": "Password reset token generated.",
            "token": token,
            "username": user.username,
        })

    return Response({"detail": "No account matches the supplied username or email."}, status=status.HTTP_404_NOT_FOUND)


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    username = request.data.get("username")
    token = request.data.get("token")
    new_password = request.data.get("new_password")
    if not all([username, token, new_password]):
        return Response({"detail": "username, token, and new_password are required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({"detail": "Invalid token or username."}, status=status.HTTP_400_BAD_REQUEST)

    if not default_token_generator.check_token(user, token):
        return Response({"detail": "Invalid or expired token."}, status=status.HTTP_400_BAD_REQUEST)

    user.set_password(new_password)
    user.must_change_password = False
    user._password_changed_by = user
    user.save(update_fields=["password", "must_change_password"])
    AuditLog.objects.create(
        actor_user=user,
        action="password_reset_confirm",
        target_table=User._meta.label,
        target_id=str(user.pk),
        after={"password_reset": True},
    )
    return Response({"detail": "Password updated successfully."})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def password_change_self(request):
    new_password = request.data.get("new_password")
    if not new_password:
        return Response({"detail": "new_password is required."}, status=status.HTTP_400_BAD_REQUEST)

    user = request.user
    user.set_password(new_password)
    user.must_change_password = False
    user._password_changed_by = user
    user.save(update_fields=["password", "must_change_password"])
    AuditLog.objects.create(
        actor_user=user,
        action="password_change_self",
        target_table=User._meta.label,
        target_id=str(user.pk),
        after={"self_service": True},
    )
    return Response({"detail": "Password updated."})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def totp_setup(request):
    """Generate or return the current TOTP secret for the requesting user."""
    user = request.user
    modified = user.ensure_totp_secret()
    if modified:
        user.save(update_fields=["totp_secret"])
    return Response(
        {
            "secret": user.totp_secret,
            "otpauth_url": user.provisioning_uri(),
            "enabled": user.totp_enabled,
        }
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def totp_activate(request):
    code = request.data.get("code")
    if not code:
        raise ValidationError({"detail": "code is required."})
    user = request.user
    secret_generated = user.ensure_totp_secret()
    if not user.verify_totp(code):
        raise ValidationError({"detail": "Invalid authenticator code."})
    updates = []
    if secret_generated:
        updates.append("totp_secret")
    if not user.totp_enabled:
        user.totp_enabled = True
        user.totp_activated_at = timezone.now()
        updates.extend(["totp_enabled", "totp_activated_at"])
    if updates:
        user.save(update_fields=list(set(updates)))
    return Response({"detail": "Authenticator enabled.", "enabled": True})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def totp_disable(request):
    code = request.data.get("code")
    user = request.user
    if user.totp_enabled:
        if not code:
            raise ValidationError({"detail": "code is required to disable authenticator."})
        if not user.verify_totp(code):
            raise ValidationError({"detail": "Invalid authenticator code."})
    user.reset_totp()
    user.save(update_fields=["totp_secret", "totp_enabled", "totp_activated_at"])
    return Response({"detail": "Authenticator disabled.", "enabled": False})


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def assign_role(request):
    acting = request.user
    allowed_actors = {User.Roles.SUPERADMIN, User.Roles.ADMIN, User.Roles.RECORDS}
    if acting.role not in allowed_actors and not acting.is_superuser:
        raise PermissionDenied("Only super admin, admin, or records can assign roles.")
    target_id = request.data.get("user_id")
    new_role = request.data.get("role")
    if not target_id or not new_role:
        raise ValidationError({"detail": "user_id and role are required."})
    target = get_object_or_404(User, pk=target_id)
    valid_roles = {choice[0] for choice in User.Roles.choices}
    if new_role not in valid_roles:
        raise ValidationError({"detail": f"Invalid role '{new_role}'."})

    if acting.role == User.Roles.ADMIN and new_role == User.Roles.SUPERADMIN:
        raise ValidationError({"detail": "Admins cannot promote users to superadmin."})
    if acting.role == User.Roles.RECORDS and new_role in {User.Roles.ADMIN, User.Roles.SUPERADMIN}:
        raise ValidationError({"detail": "Records users cannot assign admin-level roles."})
    if target == acting and new_role != User.Roles.SUPERADMIN:
        raise ValidationError({"detail": "Super administrators cannot demote themselves via API."})

    approve_now = str(request.data.get("approve_now", "")).strip().lower() in {"1", "true", "yes"}
    requires_approval = (
        new_role in SENSITIVE_ROLES
        and acting.role != User.Roles.SUPERADMIN
        and not approve_now
    )
    if requires_approval:
        pending = ApprovalRequest.objects.filter(
            action_type=ApprovalRequest.ActionType.ASSIGN_ROLE,
            status=ApprovalRequest.Status.PENDING,
            target_user=target,
            payload__role=new_role,
        ).first()
        if pending:
            return Response(
                {
                    "detail": "A matching approval request is already pending.",
                    "approval_request_id": pending.id,
                },
                status=status.HTTP_202_ACCEPTED,
            )
        approval = ApprovalRequest.objects.create(
            action_type=ApprovalRequest.ActionType.ASSIGN_ROLE,
            requested_by=acting,
            target_user=target,
            payload={
                "user_id": target.id,
                "current_role": target.role,
                "role": new_role,
            },
        )
        AuditLog.objects.create(
            actor_user=acting,
            action="role_change_requested",
            target_table=User._meta.label,
            target_id=str(target.pk),
            after={
                "approval_request_id": approval.id,
                "requested_role": new_role,
            },
        )
        return Response(
            {
                "detail": "Role change requires secondary approval.",
                "approval_request_id": approval.id,
                "status": approval.status,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    previous_role = target.role
    apply_user_role(target, new_role)
    AuditLog.objects.create(
        actor_user=acting,
        action="role_assigned",
        target_table=User._meta.label,
        target_id=str(target.pk),
        before={"role": previous_role},
        after={"role": new_role},
    )
    return Response(UserSerializer(target).data)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def provision_user(request):
    acting = request.user
    allowed_roles = {User.Roles.ADMIN, User.Roles.HOD}
    if acting.role not in allowed_roles and not acting.is_staff:
        raise PermissionDenied("Only admin or HOD users can bypass the approval queue.")
    serializer = UserProvisionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    AuditLog.objects.create(
        actor_user=acting,
        action="user_provision",
        target_table=User._meta.label,
        target_id=str(user.pk),
        after={"provisioned_role": user.role},
    )
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def admin_create_user(request):
    acting = request.user
    if acting.role not in {User.Roles.ADMIN, User.Roles.SUPERADMIN} and not acting.is_superuser:
        raise PermissionDenied("Only admin or super admin users can create accounts from the control center.")

    serializer = AdminUserCreateSerializer(
        data=request.data,
        context={
            "request": request,
            "acting_user": acting,
        },
    )
    serializer.is_valid(raise_exception=True)

    with transaction.atomic():
        user = serializer.save()
        previous_role = user.role or User.Roles.GUEST
        target_role = serializer.validated_data["role"]
        apply_user_role(user, target_role)

    AuditLog.objects.create(
        actor_user=acting,
        action="admin_user_created",
        target_table=User._meta.label,
        target_id=str(user.pk),
        before={"role": previous_role},
        after={
            "role": user.role,
            "username": user.username,
            "display_name": user.display_name,
        },
    )
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def admin_reset_password(request):
    acting = request.user
    if acting.role not in {User.Roles.ADMIN, User.Roles.SUPERADMIN} and not acting.is_superuser:
        raise PermissionDenied("Only admin or super admin users can reset passwords from the control center.")

    user_id = request.data.get("user_id")
    username = str(request.data.get("username", "")).strip()
    target = None
    if user_id:
        target = get_object_or_404(User, pk=user_id)
    elif username:
        target = get_object_or_404(User, username__iexact=username)
    else:
        raise ValidationError({"detail": "user_id or username is required."})

    try:
        temporary_password = apply_admin_password_reset(
            target=target,
            acting=acting,
            new_password=request.data.get("new_password"),
        )
    except PermissionError as exc:
        raise PermissionDenied(str(exc))
    except ValueError as exc:
        raise ValidationError({"detail": str(exc)})
    return Response(
        {
            "detail": "Password reset successfully.",
            "temporary_password": temporary_password,
            "user": UserSerializer(target).data,
        },
        status=status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([permissions.IsAuthenticated])
def enroll_family(request):
    acting = request.user
    allowed_roles = {User.Roles.RECORDS, User.Roles.ADMIN, User.Roles.HOD}
    if acting.role not in allowed_roles and not acting.is_staff:
        raise PermissionDenied("Only records, admin, or HOD users can enroll new families.")

    serializer = FamilyEnrollmentSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    payload = serializer.save()

    student_request = payload.get("student_request")
    parent_request = payload.get("parent_request")
    AuditLog.objects.create(
        actor_user=acting,
        action="family_enroll_queued",
        target_table=UserProvisionRequest._meta.label,
        target_id=str(student_request.get("id")),
        after={
            "student_username": student_request.get("username"),
            "parent_username": parent_request.get("username") if parent_request else None,
            "course_codes": payload.get("course_codes", []),
        },
    )
    return Response(payload, status=status.HTTP_201_CREATED)
