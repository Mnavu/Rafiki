import secrets

from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import UserChangeForm as BaseUserChangeForm, UserCreationForm as BaseUserCreationForm
from django import forms
from django.utils import timezone
from learning.models import CurriculumUnit, Registration

from .models import Lecturer, Student, User, ParentStudentLink, Guardian


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = (
        (None, {"fields": ("username", "password")}),
        (("Personal info"), {"fields": ("first_name", "last_name", "email", "date_of_birth", "address")}),
        (
            ("Permissions"),
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (("Important dates"), {"fields": ("last_login", "date_joined")}),
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
    readonly_fields = ("totp_activated_at", "last_login", "date_joined")
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "first_name", "last_name", "email", "role", "date_of_birth", "address", "password1", "password2"),
            },
        ),
    )
    list_display = (
        "username",
        "email",
        "first_name",
        "last_name",
        "role",
        "is_staff",
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

class ParentStudentLinkInline(admin.TabularInline):
    model = ParentStudentLink
    fk_name = "student"
    extra = 1

class StudentAdminForm(forms.ModelForm):
    units = forms.ModelMultipleChoiceField(
        queryset=CurriculumUnit.objects.all(),
        widget=admin.widgets.FilteredSelectMultiple('Units', is_stacked=False),
        required=False,
    )

    class Meta:
        model = Student
        fields = '__all__'

    def clean_units(self):
        units = self.cleaned_data.get('units')
        if units and len(units) > 4:
            raise forms.ValidationError("You can select a maximum of 4 units.")
        return units

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    form = StudentAdminForm
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
    list_display = ("user", "programme", "admission_date", "current_status")
    list_filter = ("current_status", "programme")
    inlines = [ParentStudentLinkInline]

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        units = form.cleaned_data.get('units')
        if units:
            for unit in units:
                Registration.objects.create(
                    student=obj,
                    unit=unit,
                    academic_year=obj.year,
                    trimester=obj.trimester,
                )

@admin.register(Guardian)
class GuardianAdmin(admin.ModelAdmin):
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
    list_display = ("user",)


@admin.register(Lecturer)
class LecturerAdmin(admin.ModelAdmin):
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
    list_display = ("user", "department")
    list_filter = ("department",)
