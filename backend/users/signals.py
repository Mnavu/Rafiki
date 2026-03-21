from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.db.models.signals import pre_save, post_save, post_migrate
from django.dispatch import receiver

from core.models import AuditLog

User = get_user_model()


@receiver(pre_save, sender=User)
def store_previous_password(sender, instance, **kwargs):
    if not instance.pk:
        instance._previous_password = None
        return
    try:
        existing = sender.objects.get(pk=instance.pk)
        instance._previous_password = existing.password
    except sender.DoesNotExist:
        instance._previous_password = None


@receiver(post_save, sender=User)
def audit_password_change(sender, instance, created, **kwargs):
    if created:
        return
    previous = getattr(instance, "_previous_password", None)
    if previous is None:
        return
    if instance.password != previous:
        actor = getattr(instance, "_password_changed_by", None)
        AuditLog.objects.create(
            actor_user=actor if hasattr(actor, "pk") else None,
            action="password_change",
            target_table=sender._meta.db_table,
            target_id=str(instance.pk),
            after={"password_changed": True},
        )
        if hasattr(instance, "_password_changed_by"):
            instance._password_changed_by = None


@receiver(post_migrate)
def ensure_render_admin_user(sender, app_config=None, **kwargs):
    if app_config is None or app_config.name != "users":
        return

    username = (getattr(settings, "ADMIN_USERNAME", "") or "").strip()
    password = (getattr(settings, "ADMIN_PASSWORD", "") or "").strip()
    email = (getattr(settings, "ADMIN_EMAIL", "") or "").strip()

    if not username or not password:
        return

    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            "email": email,
            "role": User.Roles.SUPERADMIN,
            "display_name": "Super Admin",
            "is_staff": True,
            "is_superuser": True,
            "must_change_password": False,
        },
    )

    updated_fields: list[str] = []

    if email and user.email != email:
        user.email = email
        updated_fields.append("email")
    if user.role != User.Roles.SUPERADMIN:
        user.role = User.Roles.SUPERADMIN
        updated_fields.append("role")
    if user.display_name != "Super Admin":
        user.display_name = "Super Admin"
        updated_fields.append("display_name")
    if not user.is_staff:
        user.is_staff = True
        updated_fields.append("is_staff")
    if not user.is_superuser:
        user.is_superuser = True
        updated_fields.append("is_superuser")
    if user.must_change_password:
        user.must_change_password = False
        updated_fields.append("must_change_password")

    if created:
        user.set_password(password)
        updated_fields.append("password")

    if updated_fields:
        user.save(update_fields=updated_fields)

    auto_seed = str(getattr(settings, "AUTO_SEED_DEMO_DATA", False)).lower() in {"1", "true", "yes", "on"}
    if not auto_seed:
        return

    if User.objects.exclude(username=username).exists():
        return

    call_command("seed_demo")

    auto_seed_uat = str(getattr(settings, "AUTO_SEED_UAT_DATA", True)).lower() in {"1", "true", "yes", "on"}
    if auto_seed_uat:
        call_command("seed_uat_data")

    auto_activate = str(getattr(settings, "AUTO_ACTIVATE_DEMO_WORKFLOWS", True)).lower() in {"1", "true", "yes", "on"}
    if auto_activate:
        call_command(
            "activate_demo_workflows",
            department_code="TT",
            hod_username="hod1",
            student_username="student1",
            guardian_username="parent1",
            all_students=True,
            bootstrap_count=3,
        )
