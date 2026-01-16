from django.contrib.auth import get_user_model
from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.dispatch import receiver

from .models import AuditLog

User = get_user_model()


@receiver(user_logged_in)
def audit_user_login(sender, request, user, **kwargs):
    AuditLog.objects.create(
        actor_user=user,
        action="login",
        target_table=user._meta.label,
        target_id=str(user.pk),
        after={
            "remote_addr": request.META.get("REMOTE_ADDR"),
            "user_agent": request.META.get("HTTP_USER_AGENT"),
        },
    )


@receiver(user_logged_out)
def audit_user_logout(sender, request, user, **kwargs):
    AuditLog.objects.create(
        actor_user=user if isinstance(user, User) else None,
        action="logout",
        target_table=user._meta.label if isinstance(user, User) else "auth.User",
        target_id=str(user.pk) if isinstance(user, User) else "",
        after={
            "remote_addr": request.META.get("REMOTE_ADDR"),
            "user_agent": request.META.get("HTTP_USER_AGENT"),
        },
    )
