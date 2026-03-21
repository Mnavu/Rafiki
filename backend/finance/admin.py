from decimal import Decimal

from django.contrib import admin, messages
from django.utils import timezone

from core.models import AuditLog
from users.models import Student, User

from .models import FeeStructure, Payment, FinanceThreshold, FinanceStatus


def recalculate_finance_status(finance_status: FinanceStatus) -> FinanceStatus:
    total_paid = (
        Payment.objects.filter(
            student=finance_status.student,
            academic_year=finance_status.academic_year,
            trimester=finance_status.trimester,
        )
        .values_list("amount", flat=True)
    )
    finance_status.total_paid = sum(total_paid, Decimal("0.00"))
    if finance_status.total_due > 0:
        percentage_paid = (finance_status.total_paid / finance_status.total_due) * Decimal("100.0")
        if percentage_paid >= Decimal("100.0"):
            finance_status.status = FinanceStatus.Status.PAID
        elif percentage_paid >= Decimal("1.0"):
            finance_status.status = FinanceStatus.Status.PARTIAL
        else:
            finance_status.status = FinanceStatus.Status.PENDING
    else:
        finance_status.status = (
            FinanceStatus.Status.PAID if finance_status.total_paid > 0 else FinanceStatus.Status.PENDING
        )
    finance_status.save(update_fields=["total_paid", "status", "updated_at"])
    return finance_status


@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = ("programme", "academic_year", "trimester")
    list_filter = ("academic_year", "trimester", "programme")
    search_fields = ("programme__code",)
    autocomplete_fields = ("programme",)


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("student", "amount", "academic_year", "trimester", "paid_at", "method")
    list_filter = ("academic_year", "trimester", "method", "paid_at")
    search_fields = ("student__user__username", "student__user__display_name", "ref")
    autocomplete_fields = ("student",)

    def save_model(self, request, obj, form, change):
        if not obj.paid_at:
            obj.paid_at = timezone.now()
        super().save_model(request, obj, form, change)
        finance_status, _ = FinanceStatus.objects.get_or_create(
            student=obj.student,
            academic_year=obj.academic_year,
            trimester=obj.trimester,
            defaults={
                "total_due": Decimal("0.00"),
                "total_paid": Decimal("0.00"),
                "status": FinanceStatus.Status.PENDING,
                "clearance_status": FinanceStatus.Clearance.BLOCKED,
            },
        )
        recalculate_finance_status(finance_status)
        AuditLog.objects.create(
            actor_user=request.user,
            action="payment_recorded_via_admin",
            target_table=Payment._meta.label,
            target_id=str(obj.id),
            after={
                "student_username": obj.student.user.username if obj.student_id else "",
                "amount": str(obj.amount),
                "academic_year": obj.academic_year,
                "trimester": obj.trimester,
            },
        )


@admin.register(FinanceThreshold)
class FinanceThresholdAdmin(admin.ModelAdmin):
    list_display = ("programme", "academic_year", "trimester", "threshold_amount")
    list_filter = ("academic_year", "trimester", "programme")
    search_fields = ("programme__code",)
    autocomplete_fields = ("programme",)


@admin.register(FinanceStatus)
class FinanceStatusAdmin(admin.ModelAdmin):
    actions = (
        "recalculate_selected_finance_rows",
        "clear_selected_for_registration",
        "block_selected_from_registration",
    )
    list_display = (
        "student",
        "academic_year",
        "trimester",
        "total_due",
        "total_paid",
        "percent_paid",
        "balance",
        "status",
        "clearance_status",
    )
    list_filter = ("academic_year", "trimester", "status", "clearance_status")
    search_fields = ("student__user__username", "student__user__display_name")
    readonly_fields = ("balance",)
    autocomplete_fields = ("student",)
    @admin.display(description="Paid %")
    def percent_paid(self, obj):
        if obj.total_due <= 0:
            return "0%"
        return f"{((obj.total_paid / obj.total_due) * Decimal('100.0')):.2f}%"

    @admin.action(description="Recalculate totals from recorded payments")
    def recalculate_selected_finance_rows(self, request, queryset):
        count = 0
        for finance_status in queryset:
            recalculate_finance_status(finance_status)
            count += 1
        if count:
            self.message_user(request, f"Recalculated {count} finance row(s).", level=messages.SUCCESS)

    @admin.action(description="Clear selected students for unit registration")
    def clear_selected_for_registration(self, request, queryset):
        if not (request.user.is_superuser or request.user.role in {User.Roles.ADMIN, User.Roles.SUPERADMIN, User.Roles.FINANCE}):
            self.message_user(request, "Only finance or admin users can clear students.", level=messages.ERROR)
            return

        count = 0
        for finance_status in queryset.select_related("student__user"):
            recalculate_finance_status(finance_status)
            if finance_status.total_due <= 0:
                messages.error(request, f"{finance_status.student}: total due must be greater than zero.")
                continue
            percentage_paid = (finance_status.total_paid / finance_status.total_due) * Decimal("100.0")
            if percentage_paid < Decimal("60.0"):
                messages.error(
                    request,
                    f"{finance_status.student}: only {percentage_paid:.2f}% paid, below the 60% threshold.",
                )
                continue

            finance_status.clearance_status = FinanceStatus.Clearance.CLEARED_FOR_REGISTRATION
            finance_status.status = (
                FinanceStatus.Status.PAID
                if percentage_paid >= Decimal("100.0")
                else FinanceStatus.Status.PARTIAL
            )
            finance_status.save(update_fields=["clearance_status", "status", "updated_at"])
            if finance_status.student and finance_status.student.current_status != Student.Status.FINANCE_OK:
                finance_status.student.current_status = Student.Status.FINANCE_OK
                finance_status.student.save(update_fields=["current_status"])
            AuditLog.objects.create(
                actor_user=request.user,
                action="finance_clearance_opened_via_admin",
                target_table=FinanceStatus._meta.label,
                target_id=str(finance_status.id),
                after={
                    "student_username": finance_status.student.user.username if finance_status.student_id else "",
                    "percentage_paid": float(percentage_paid),
                    "clearance_status": finance_status.clearance_status,
                },
            )
            count += 1

        if count:
            self.message_user(request, f"Cleared {count} student(s) for registration.", level=messages.SUCCESS)

    @admin.action(description="Block selected students from registration")
    def block_selected_from_registration(self, request, queryset):
        if not (request.user.is_superuser or request.user.role in {User.Roles.ADMIN, User.Roles.SUPERADMIN, User.Roles.FINANCE}):
            self.message_user(request, "Only finance or admin users can block students.", level=messages.ERROR)
            return

        count = 0
        for finance_status in queryset.select_related("student__user"):
            finance_status.clearance_status = FinanceStatus.Clearance.BLOCKED
            finance_status.save(update_fields=["clearance_status", "updated_at"])
            if finance_status.student and finance_status.student.current_status != Student.Status.BLOCKED:
                finance_status.student.current_status = Student.Status.BLOCKED
                finance_status.student.save(update_fields=["current_status"])
            AuditLog.objects.create(
                actor_user=request.user,
                action="finance_clearance_blocked_via_admin",
                target_table=FinanceStatus._meta.label,
                target_id=str(finance_status.id),
                after={
                    "student_username": finance_status.student.user.username if finance_status.student_id else "",
                    "clearance_status": finance_status.clearance_status,
                },
            )
            count += 1
        if count:
            self.message_user(request, f"Blocked {count} student(s) from registration.", level=messages.SUCCESS)
