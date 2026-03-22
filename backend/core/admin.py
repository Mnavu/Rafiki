import csv
import io
import json

from django.contrib import admin, messages
from django.http import HttpResponse
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html

from users.models import User
from users.role_assignment import apply_user_role

from .models import (
    ApprovalRequest,
    AuditLog,
    DataBundleImport,
    DataGovernancePolicy,
    Department,
    ReportRecord,
    ReportSchedule,
    RiskFlag,
    RoleAlertPolicy,
)


def _build_csv_response(filename: str, rows: list[dict]) -> HttpResponse:
    output = io.StringIO()
    fieldnames = sorted({key for row in rows for key in row.keys()}) if rows else ["value"]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows or [{"value": ""}]:
        writer.writerow(row)
    response = HttpResponse(output.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}.csv"'
    return response


def _build_json_response(filename: str, payload) -> HttpResponse:
    response = HttpResponse(
        json.dumps(payload, indent=2, default=str),
        content_type="application/json",
    )
    response["Content-Disposition"] = f'attachment; filename="{filename}.json"'
    return response


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    actions = ("export_selected_as_csv",)
    list_display = (
        "created_at",
        "actor_user",
        "action",
        "target_table",
        "target_id",
        "request_method",
        "request_status",
    )
    list_filter = ("action", "target_table", "actor_user", "request_method", "request_status")
    search_fields = ("actor_user__username", "target_table", "target_id", "request_path", "request_id")
    readonly_fields = (
        "event_id",
        "created_at",
        "actor_user",
        "action",
        "target_table",
        "target_id",
        "before",
        "after",
        "request_id",
        "request_path",
        "request_method",
        "request_status",
        "ip_address",
        "user_agent",
        "metadata",
        "previous_hash",
        "integrity_hash",
    )

    @admin.action(description="Export selected audit logs as CSV")
    def export_selected_as_csv(self, request, queryset):
        rows = [
            {
                "created_at": row.created_at.isoformat(),
                "actor_username": row.actor_user.username if row.actor_user_id else "",
                "action": row.action,
                "target_table": row.target_table,
                "target_id": row.target_id,
                "request_method": row.request_method,
                "request_path": row.request_path,
                "request_status": row.request_status,
                "request_id": row.request_id,
                "ip_address": row.ip_address,
            }
            for row in queryset.select_related("actor_user")
        ]
        return _build_csv_response("audit-logs-selection", rows)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "head_of_department")
    search_fields = ("name", "code", "head_of_department__user__username")
    autocomplete_fields = ("head_of_department",)


@admin.register(DataBundleImport)
class DataBundleImportAdmin(admin.ModelAdmin):
    list_display = ("bundle_name", "bundle_sha256", "record_count", "loaded_at", "updated_at")
    readonly_fields = ("bundle_name", "bundle_sha256", "source_path", "record_count", "loaded_at", "created_at", "updated_at")
    search_fields = ("bundle_name", "bundle_sha256", "source_path")

    def has_add_permission(self, request):
        return False


@admin.register(ReportRecord)
class ReportRecordAdmin(admin.ModelAdmin):
    actions = ("download_selected_csv", "download_selected_json")
    list_display = (
        "generated_at",
        "name",
        "report_type",
        "status",
        "rows_count",
        "generated_by",
        "download_links",
    )
    list_filter = ("report_type", "status", "format")
    search_fields = ("name", "report_type", "generated_by__username")
    readonly_fields = ("generated_at", "created_at", "updated_at", "rows_count", "summary", "payload")

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "<path:object_id>/download-csv/",
                self.admin_site.admin_view(self.download_csv_view),
                name="core_reportrecord_download_csv",
            ),
            path(
                "<path:object_id>/download-json/",
                self.admin_site.admin_view(self.download_json_view),
                name="core_reportrecord_download_json",
            ),
        ]
        return custom_urls + urls

    @admin.display(description="Downloads")
    def download_links(self, obj):
        csv_url = reverse("admin:core_reportrecord_download_csv", args=[obj.pk])
        json_url = reverse("admin:core_reportrecord_download_json", args=[obj.pk])
        return format_html('<a href="{}">CSV</a> | <a href="{}">JSON</a>', csv_url, json_url)

    def download_csv_view(self, request, object_id):
        record = self.get_object(request, object_id)
        return _build_csv_response(f"report-{record.id}", record.payload)

    def download_json_view(self, request, object_id):
        record = self.get_object(request, object_id)
        return _build_json_response(f"report-{record.id}", record.payload)

    @admin.action(description="Download selected report payload as CSV")
    def download_selected_csv(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "Select exactly one report to download as CSV.", level=messages.ERROR)
            return None
        record = queryset.first()
        return _build_csv_response(f"report-{record.id}", record.payload)

    @admin.action(description="Download selected report payload as JSON")
    def download_selected_json(self, request, queryset):
        if queryset.count() != 1:
            self.message_user(request, "Select exactly one report to download as JSON.", level=messages.ERROR)
            return None
        record = queryset.first()
        return _build_json_response(f"report-{record.id}", record.payload)


@admin.register(ReportSchedule)
class ReportScheduleAdmin(admin.ModelAdmin):
    list_display = ("name", "report_type", "frequency", "next_run_at", "is_active", "last_run_at")
    list_filter = ("report_type", "frequency", "is_active")
    search_fields = ("name", "report_type")


@admin.register(DataGovernancePolicy)
class DataGovernancePolicyAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "audit_retention_days",
        "chat_retention_days",
        "report_retention_days",
        "backup_enabled",
        "backup_frequency",
    )


@admin.register(RoleAlertPolicy)
class RoleAlertPolicyAdmin(admin.ModelAdmin):
    list_display = ("role", "metric_key", "warning_threshold", "critical_threshold", "is_active")
    list_filter = ("role", "is_active")
    search_fields = ("role", "metric_key")


@admin.register(RiskFlag)
class RiskFlagAdmin(admin.ModelAdmin):
    list_display = ("detected_at", "flag_type", "severity", "status", "user", "student")
    list_filter = ("flag_type", "severity", "status")
    search_fields = ("flag_type", "reason", "user__username", "student__user__username")


@admin.register(ApprovalRequest)
class ApprovalRequestAdmin(admin.ModelAdmin):
    actions = ("approve_selected_requests", "reject_selected_requests")
    list_display = ("created_at", "action_type", "status", "requested_by", "target_user", "reviewed_by")
    list_filter = ("action_type", "status")
    search_fields = ("requested_by__username", "target_user__username", "reviewed_by__username")

    @admin.action(description="Approve selected approval requests")
    def approve_selected_requests(self, request, queryset):
        if not request.user.is_staff:
            self.message_user(request, "Only staff can approve requests.", level=messages.ERROR)
            return

        count = 0
        for approval in queryset.select_related("target_user", "requested_by", "reviewed_by"):
            if approval.status != ApprovalRequest.Status.PENDING:
                continue

            approved_payload = dict(approval.payload or {})
            if approval.action_type == ApprovalRequest.ActionType.ASSIGN_ROLE:
                target = approval.target_user
                requested_role = approved_payload.get("role")
                valid_roles = {choice[0] for choice in User.Roles.choices}
                if not target or requested_role not in valid_roles:
                    self.message_user(
                        request,
                        f"Approval {approval.id} is missing a valid target or role.",
                        level=messages.ERROR,
                    )
                    continue
                previous_role = target.role
                apply_user_role(target, requested_role)
                approved_payload["previous_role"] = previous_role
                approved_payload["applied_role"] = requested_role
                AuditLog.objects.create(
                    actor_user=request.user,
                    action="role_assigned_via_admin_approval",
                    target_table=User._meta.label,
                    target_id=str(target.id),
                    before={"role": previous_role},
                    after={"role": requested_role, "approval_request_id": approval.id},
                )

            approval.status = ApprovalRequest.Status.APPROVED
            approval.reviewed_by = request.user
            approval.reviewed_at = timezone.now()
            approval.comment = approval.comment or "Approved from Django admin."
            approval.approved_payload = approved_payload
            approval.save(
                update_fields=[
                    "status",
                    "reviewed_by",
                    "reviewed_at",
                    "comment",
                    "approved_payload",
                    "updated_at",
                ]
            )
            AuditLog.objects.create(
                actor_user=request.user,
                action="approval_request_approved_via_admin",
                target_table=ApprovalRequest._meta.label,
                target_id=str(approval.id),
                after={"status": approval.status, "action_type": approval.action_type},
            )
            count += 1

        if count:
            self.message_user(request, f"Approved {count} approval request(s).", level=messages.SUCCESS)

    @admin.action(description="Reject selected approval requests")
    def reject_selected_requests(self, request, queryset):
        if not request.user.is_staff:
            self.message_user(request, "Only staff can reject requests.", level=messages.ERROR)
            return

        count = 0
        for approval in queryset:
            if approval.status != ApprovalRequest.Status.PENDING:
                continue
            approval.status = ApprovalRequest.Status.REJECTED
            approval.reviewed_by = request.user
            approval.reviewed_at = timezone.now()
            approval.comment = approval.comment or "Rejected from Django admin."
            approval.save(
                update_fields=["status", "reviewed_by", "reviewed_at", "comment", "updated_at"]
            )
            AuditLog.objects.create(
                actor_user=request.user,
                action="approval_request_rejected_via_admin",
                target_table=ApprovalRequest._meta.label,
                target_id=str(approval.id),
                after={"status": approval.status, "action_type": approval.action_type},
            )
            count += 1

        if count:
            self.message_user(request, f"Rejected {count} approval request(s).", level=messages.SUCCESS)
