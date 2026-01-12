import secrets

from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Lecturer, Student, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "Accessibility & Role",
            {
                "fields": (
                    "role",
                    "display_name",
                    "must_change_password",
                    "prefers_simple_language",
                    "prefers_high_contrast",
                    "speech_rate",
                    "totp_enabled",
                    "totp_activated_at",
                )
            },
        ),
    )
    readonly_fields = ("totp_activated_at",)
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "email", "role", "password1", "password2"),
            },
        ),
    )
    list_display = (
        "username",
        "email",
        "role",
        "must_change_password",
        "prefers_simple_language",
        "prefers_high_contrast",
        "totp_enabled",
    )

    def save_model(self, request, obj, form, change):
        generated_password = None
        if not change:
            generated_password = secrets.token_urlsafe(8)
            obj.set_password(generated_password)
            obj.must_change_password = True
            obj._password_changed_by = request.user
        else:
            if "password" in form.changed_data:
                obj.must_change_password = False
                obj._password_changed_by = request.user
        super().save_model(request, obj, form, change)
        if generated_password:
            messages.info(
                request,
                f"Temporary password for {obj.username}: {generated_password}. Share securely and prompt them to reset.",
            )


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
    list_display = ("user", "programme", "year", "current_status")
    list_filter = ("current_status", "year", "programme")


@admin.register(Lecturer)
class LecturerAdmin(admin.ModelAdmin):
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
    list_display = ("user", "department")
    list_filter = ("department",)
