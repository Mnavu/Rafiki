import secrets

from django import forms
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import (
    UserChangeForm as BaseUserChangeForm,
    UserCreationForm as BaseUserCreationForm,
)
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction

from finance.models import FinanceStatus
from learning.models import CurriculumUnit, Registration

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
from .provisioning import (
    admin_reset_password as reset_password_workflow,
    approve_provision_request,
    reject_provision_request,
    resend_provision_credentials,
)

username_validator = UnicodeUsernameValidator()


class CustomDateWidget(forms.DateInput):
    def __init__(self, attrs=None):
        attrs = attrs or {}
        attrs["class"] = "flatpickr-date-input"
        super().__init__(attrs)


class CustomUserChangeForm(BaseUserChangeForm):
    class Meta(BaseUserChangeForm.Meta):
        model = User
        widgets = {"date_of_birth": CustomDateWidget()}


class CustomUserCreationForm(BaseUserCreationForm):
    class Meta(BaseUserCreationForm.Meta):
        model = User
        fields = (
            "username",
            "first_name",
            "last_name",
            "email",
            "role",
            "date_of_birth",
            "address",
        )
        widgets = {"date_of_birth": CustomDateWidget()}


class BaseAdminWithCalendar(admin.ModelAdmin):
    class Media:
        css = {"all": ("https://npmcdn.com/flatpickr/dist/flatpickr.min.css",)}
        js = (
            "https://npmcdn.com/flatpickr/dist/flatpickr.min.js",
            "core/js/custom_datepicker.js",
        )


class ParentStudentLinkInline(admin.TabularInline):
    model = ParentStudentLink
    fk_name = "student"
    extra = 1


class StudentAdminForm(forms.ModelForm):
    units = forms.ModelMultipleChoiceField(
        queryset=CurriculumUnit.objects.all(),
        widget=admin.widgets.FilteredSelectMultiple("Units", is_stacked=False),
        required=False,
    )

    class Meta:
        model = Student
        fields = "__all__"

    def clean_units(self):
        units = self.cleaned_data.get("units")
        if units and len(units) > 4:
            raise forms.ValidationError("You can select a maximum of 4 units.")
        return units


class FamilyEnrollmentIntentAdminForm(forms.ModelForm):
    student_username = forms.CharField(max_length=150)
    student_password = forms.CharField(widget=forms.PasswordInput(render_value=True), min_length=6)
    student_display_name = forms.CharField(max_length=255, required=False)
    student_first_name = forms.CharField(max_length=150, required=False)
    student_last_name = forms.CharField(max_length=150, required=False)
    student_email = forms.EmailField(required=False)

    parent_username = forms.CharField(max_length=150)
    parent_password = forms.CharField(widget=forms.PasswordInput(render_value=True), min_length=6)
    parent_display_name = forms.CharField(max_length=255, required=False)
    parent_first_name = forms.CharField(max_length=150, required=False)
    parent_last_name = forms.CharField(max_length=150, required=False)
    parent_email = forms.EmailField(required=False)

    course_codes_text = forms.CharField(
        required=False,
        help_text="Optional comma-separated course or unit codes.",
        widget=forms.Textarea(attrs={"rows": 2}),
    )

    class Meta:
        model = FamilyEnrollmentIntent
        fields = (
            "programme",
            "year",
            "trimester",
            "trimester_label",
            "cohort_year",
            "relationship",
            "fee_title",
            "fee_amount",
            "fee_due_date",
        )

    def _validate_username(self, value: str, label: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise forms.ValidationError(f"{label} username is required.")
        try:
            username_validator(normalized)
        except DjangoValidationError as exc:
            raise forms.ValidationError(exc.messages[0])
        if User.objects.filter(username__iexact=normalized).exists():
            raise forms.ValidationError(f"{label} username already exists.")
        if UserProvisionRequest.objects.filter(
            username__iexact=normalized,
            status=UserProvisionRequest.Status.PENDING,
        ).exists():
            raise forms.ValidationError(f"A pending provisioning request already exists for {normalized}.")
        return normalized

    def clean(self):
        cleaned_data = super().clean()
        if self.instance.pk:
            return cleaned_data

        student_username = self._validate_username(
            cleaned_data.get("student_username", ""),
            "Student",
        )
        parent_username = self._validate_username(
            cleaned_data.get("parent_username", ""),
            "Guardian",
        )
        if student_username == parent_username:
            raise forms.ValidationError("Student and Guardian usernames must be different.")

        cleaned_data["student_username"] = student_username
        cleaned_data["parent_username"] = parent_username
        cleaned_data["course_codes"] = [
            code.strip().upper()
            for code in (cleaned_data.get("course_codes_text") or "").replace("\n", ",").split(",")
            if code.strip()
        ]

        if not cleaned_data.get("programme"):
            raise forms.ValidationError("Programme is required.")
        if not cleaned_data.get("year"):
            raise forms.ValidationError("Year is required.")
        if not cleaned_data.get("trimester"):
            raise forms.ValidationError("Trimester is required.")
        if not cleaned_data.get("trimester_label"):
            raise forms.ValidationError("Trimester label is required.")
        return cleaned_data


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    form = CustomUserChangeForm
    add_form = CustomUserCreationForm
    actions = ["reset_selected_passwords"]

    class Media:
        css = {"all": ("https://npmcdn.com/flatpickr/dist/flatpickr.min.css",)}
        js = (
            "https://npmcdn.com/flatpickr/dist/flatpickr.min.js",
            "core/js/custom_datepicker.js",
        )

    fieldsets = (
        (None, {"fields": ("username", "password")}),
        (
            ("Personal info"),
            {"fields": ("first_name", "last_name", "email", "date_of_birth", "address")},
        ),
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
                "fields": (
                    "username",
                    "first_name",
                    "last_name",
                    "email",
                    "role",
                    "date_of_birth",
                    "address",
                    "password1",
                    "password2",
                ),
            },
        ),
    )
    list_display = ("username", "email", "first_name", "last_name", "role", "is_staff")
    list_filter = ("role", "is_staff", "is_superuser", "is_active")
    search_fields = ("username", "email", "first_name", "last_name", "display_name")

    @admin.action(description="Reset selected dashboard passwords")
    def reset_selected_passwords(self, request, queryset):
        count = 0
        for user in queryset:
            try:
                temporary_password = reset_password_workflow(target=user, acting=request.user)
                messages.info(
                    request,
                    f"Temporary password for {user.username}: {temporary_password}",
                )
                count += 1
            except PermissionError as exc:
                messages.error(request, f"{user.username}: {exc}")
            except ValueError as exc:
                messages.error(request, f"{user.username}: {exc}")
        if count:
            messages.success(request, f"Reset {count} user password(s).")

    def save_model(self, request, obj, form, change):
        generated_password = None
        if not change:
            generated_password = secrets.token_urlsafe(8)
            obj.set_password(generated_password)
            obj.must_change_password = True
            obj._password_changed_by = request.user
        elif "password" in form.changed_data:
            obj.must_change_password = False
            obj._password_changed_by = request.user
        super().save_model(request, obj, form, change)
        if generated_password:
            messages.info(
                request,
                f"Temporary password for {obj.username}: {generated_password}. Share securely and prompt them to reset.",
            )


@admin.register(Student)
class StudentAdmin(BaseAdminWithCalendar):
    form = StudentAdminForm
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
    list_display = ("user", "programme", "admission_date", "current_status")
    list_filter = ("current_status", "programme")
    autocomplete_fields = ("user", "programme")
    inlines = [ParentStudentLinkInline]

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        units = form.cleaned_data.get("units")
        for unit in units or []:
            Registration.objects.get_or_create(
                student=obj,
                unit=unit,
                academic_year=obj.year,
                trimester=obj.trimester,
                defaults={"status": Registration.Status.PENDING_HOD},
            )


@admin.register(Guardian)
class GuardianAdmin(BaseAdminWithCalendar):
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
    list_display = ("user",)
    autocomplete_fields = ("user",)


@admin.register(Lecturer)
class LecturerAdmin(BaseAdminWithCalendar):
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
    list_display = ("user", "department")
    list_filter = ("department",)
    autocomplete_fields = ("user", "department")


@admin.register(HOD)
class HODAdmin(BaseAdminWithCalendar):
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
    list_display = ("user", "department")
    autocomplete_fields = ("user", "department")


@admin.register(Admin)
class AdminProfileAdmin(BaseAdminWithCalendar):
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
    list_display = ("user",)
    autocomplete_fields = ("user",)


@admin.register(RecordsOfficer)
class RecordsOfficerAdmin(BaseAdminWithCalendar):
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
    list_display = ("user",)
    autocomplete_fields = ("user",)


@admin.register(FinanceOfficer)
class FinanceOfficerAdmin(BaseAdminWithCalendar):
    search_fields = ("user__username", "user__first_name", "user__last_name", "user__email")
    list_display = ("user",)
    autocomplete_fields = ("user",)


@admin.register(ParentStudentLink)
class ParentStudentLinkAdmin(admin.ModelAdmin):
    list_display = ("parent", "student", "relationship", "created_at")
    search_fields = (
        "parent__user__username",
        "parent__user__display_name",
        "student__user__username",
        "student__user__display_name",
    )
    autocomplete_fields = ("parent", "student")


@admin.register(UserProvisionRequest)
class UserProvisionRequestAdmin(admin.ModelAdmin):
    actions = [
        "approve_selected_requests",
        "reject_selected_requests",
        "resend_selected_credentials",
    ]
    list_display = (
        "username",
        "role",
        "status",
        "requested_by",
        "reviewed_by",
        "created_user",
        "temporary_password_hint",
        "created_at",
    )
    list_filter = ("status", "role")
    search_fields = ("username", "display_name", "email", "requested_by__username")
    autocomplete_fields = ("requested_by", "reviewed_by", "created_user")
    readonly_fields = (
        "requested_by",
        "reviewed_by",
        "reviewed_at",
        "created_user",
        "temporary_password",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    @admin.display(description="Temporary password")
    def temporary_password_hint(self, obj):
        return obj.temporary_password or "Pending approval"

    @admin.action(description="Approve selected provisioning requests")
    def approve_selected_requests(self, request, queryset):
        count = 0
        for provision_request in queryset.select_related("requested_by", "reviewed_by", "created_user"):
            try:
                user, temporary_password = approve_provision_request(
                    provision_request,
                    acting=request.user,
                )
                messages.info(
                    request,
                    f"Approved {provision_request.username}. Temporary password: {temporary_password}",
                )
                count += 1
            except ValueError as exc:
                messages.error(request, f"{provision_request.username}: {exc}")
        if count:
            messages.success(request, f"Approved {count} provisioning request(s).")

    @admin.action(description="Reject selected provisioning requests")
    def reject_selected_requests(self, request, queryset):
        count = 0
        for provision_request in queryset:
            try:
                reject_provision_request(
                    provision_request,
                    acting=request.user,
                    reason="Rejected from Django admin.",
                )
                count += 1
            except ValueError as exc:
                messages.error(request, f"{provision_request.username}: {exc}")
        if count:
            messages.success(request, f"Rejected {count} provisioning request(s).")

    @admin.action(description="Re-send credentials for approved requests")
    def resend_selected_credentials(self, request, queryset):
        count = 0
        for provision_request in queryset:
            try:
                resend_provision_credentials(provision_request)
                count += 1
            except ValueError as exc:
                messages.error(request, f"{provision_request.username}: {exc}")
        if count:
            messages.success(request, f"Re-sent credentials for {count} approved request(s).")


@admin.register(FamilyEnrollmentIntent)
class FamilyEnrollmentIntentAdmin(BaseAdminWithCalendar):
    form = FamilyEnrollmentIntentAdminForm
    actions = ["approve_related_requests"]
    list_display = (
        "student_request",
        "parent_request",
        "programme",
        "year",
        "trimester",
        "fee_amount",
        "created_at",
    )
    list_select_related = ("student_request", "parent_request", "programme")
    search_fields = (
        "student_request__username",
        "parent_request__username",
        "programme__code",
        "programme__name",
    )
    autocomplete_fields = ("programme", "student_request", "parent_request")
    readonly_fields = (
        "student_request",
        "parent_request",
        "course_codes",
        "created_at",
        "updated_at",
    )

    def get_fields(self, request, obj=None):
        if obj:
            return (
                "student_request",
                "parent_request",
                "programme",
                "year",
                "trimester",
                "trimester_label",
                "cohort_year",
                "relationship",
                "course_codes",
                "fee_title",
                "fee_amount",
                "fee_due_date",
                "created_at",
                "updated_at",
            )
        return (
            "programme",
            "year",
            "trimester",
            "trimester_label",
            "cohort_year",
            "relationship",
            "course_codes_text",
            "student_username",
            "student_password",
            "student_display_name",
            "student_first_name",
            "student_last_name",
            "student_email",
            "parent_username",
            "parent_password",
            "parent_display_name",
            "parent_first_name",
            "parent_last_name",
            "parent_email",
            "fee_title",
            "fee_amount",
            "fee_due_date",
        )

    def save_model(self, request, obj, form, change):
        if change:
            super().save_model(request, obj, form, change)
            return

        cleaned = form.cleaned_data
        with transaction.atomic():
            student_request = UserProvisionRequest.objects.create(
                requested_by=request.user,
                username=cleaned["student_username"],
                display_name=cleaned.get("student_display_name", "").strip(),
                email=cleaned.get("student_email", "").strip(),
                role=User.Roles.STUDENT,
            )
            parent_request = UserProvisionRequest.objects.create(
                requested_by=request.user,
                username=cleaned["parent_username"],
                display_name=cleaned.get("parent_display_name", "").strip(),
                email=cleaned.get("parent_email", "").strip(),
                role=User.Roles.PARENT,
            )

            obj.student_request = student_request
            obj.parent_request = parent_request
            obj.relationship = cleaned.get("relationship", "").strip()
            obj.course_codes = list(dict.fromkeys(cleaned.get("course_codes", [])))
            obj.student_first_name = cleaned.get("student_first_name", "").strip()
            obj.student_last_name = cleaned.get("student_last_name", "").strip()
            obj.student_password = cleaned.get("student_password", "")
            obj.parent_first_name = cleaned.get("parent_first_name", "").strip()
            obj.parent_last_name = cleaned.get("parent_last_name", "").strip()
            obj.parent_password = cleaned.get("parent_password", "")
            super().save_model(request, obj, form, change)

        messages.success(
            request,
            f"Queued family enrollment for {student_request.username} and {parent_request.username}. Approve their provisioning requests next.",
        )

    @admin.action(description="Approve both student and Guardian requests for selected enrollments")
    def approve_related_requests(self, request, queryset):
        approved = 0
        for intent in queryset.select_related("student_request", "parent_request"):
            for provision_request in [intent.student_request, intent.parent_request]:
                if not provision_request:
                    continue
                if provision_request.status != UserProvisionRequest.Status.PENDING:
                    continue
                try:
                    approve_provision_request(provision_request, acting=request.user)
                    approved += 1
                except ValueError as exc:
                    messages.error(request, f"{provision_request.username}: {exc}")
        if approved:
            messages.success(request, f"Approved {approved} related provisioning request(s).")
