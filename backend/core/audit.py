import json
import sys
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.forms.models import model_to_dict
from django.core.serializers.json import DjangoJSONEncoder
from django.utils.timezone import now

from .models import AuditLog
from . import state

# Disable auditing during migrations/tests to avoid breaking atomic blocks
_DISABLE_AUDIT = any(cmd in sys.argv for cmd in ("makemigrations", "migrate", "test"))

# Only audit our project apps
_PROJECT_APPS = {"core", "users", "learning", "finance", "communications", "repository", "chatbot", "notifications"}


def _to_jsonable(data):
    try:
        # Convert datetimes/Decimals/etc. to JSON-friendly values
        return json.loads(json.dumps(data, cls=DjangoJSONEncoder))
    except Exception:
        return {}


def _log_change(instance, action: str):
    if _DISABLE_AUDIT:
        return
    actor = getattr(instance, "_audit_user", None) or getattr(instance, "_password_changed_by", None) or state.get_user()
    try:
        AuditLog.objects.create(
            actor_user=actor if getattr(actor, "pk", None) else None,
            action=action,
            target_table=instance._meta.label,
            target_id=str(getattr(instance, "pk", "")),
            after=_to_jsonable(model_to_dict(instance)),
        )
    except Exception:
        # Keep failures silent in skeleton; production should log errors
        pass
    finally:
        if hasattr(instance, "_audit_user"):
            delattr(instance, "_audit_user")
        if hasattr(instance, "_password_changed_by"):
            delattr(instance, "_password_changed_by")


@receiver(post_save)
def _post_save(sender, instance, created, **kwargs):
    if _DISABLE_AUDIT:
        return
    # Skip non-project apps and audit log itself
    if sender._meta.app_label not in _PROJECT_APPS:
        return
    if sender is AuditLog:
        return
    _log_change(instance, "created" if created else "updated")


@receiver(post_delete)
def _post_delete(sender, instance, **kwargs):
    if _DISABLE_AUDIT:
        return
    if sender._meta.app_label not in _PROJECT_APPS:
        return
    if sender is AuditLog:
        return
    _log_change(instance, "deleted")

def log_api_request(request, response):
    if _DISABLE_AUDIT:
        return
    info = state.get_request_info() or {}
    user = state.get_user()
    try:
        AuditLog.objects.create(
            actor_user=user if getattr(user, "pk", None) else None,
            action="api_request",
            target_table="http",
            target_id=info.get("path", request.path),
            request_id=info.get("request_id", ""),
            request_path=info.get("path", request.path),
            request_method=info.get("method", request.method),
            request_status=getattr(response, "status_code", None),
            ip_address=info.get("remote_addr") or "",
            user_agent=info.get("user_agent") or "",
            after=_to_jsonable({
                "method": info.get("method", request.method),
                "status": getattr(response, "status_code", None),
                "remote_addr": info.get("remote_addr"),
                "user_agent": info.get("user_agent"),
                "timestamp": now().isoformat(),
            }),
        )
    except Exception:
        pass


