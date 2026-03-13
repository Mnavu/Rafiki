from django.contrib import admin
from .models import (
    AuditLog,
    ApprovalRequest,
    DataGovernancePolicy,
    ReportRecord,
    ReportSchedule,
    RiskFlag,
    RoleAlertPolicy,
)

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        'created_at',
        'actor_user',
        'action',
        'target_table',
        'target_id',
        'request_method',
        'request_status',
    )
    list_filter = ('action', 'target_table', 'actor_user', 'request_method', 'request_status')
    search_fields = ('actor_user__username', 'target_table', 'target_id', 'request_path', 'request_id')
    readonly_fields = (
        'event_id',
        'created_at',
        'actor_user',
        'action',
        'target_table',
        'target_id',
        'before',
        'after',
        'request_id',
        'request_path',
        'request_method',
        'request_status',
        'ip_address',
        'user_agent',
        'metadata',
        'previous_hash',
        'integrity_hash',
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ReportRecord)
class ReportRecordAdmin(admin.ModelAdmin):
    list_display = ('generated_at', 'name', 'report_type', 'status', 'rows_count', 'generated_by')
    list_filter = ('report_type', 'status', 'format')
    search_fields = ('name', 'report_type', 'generated_by__username')
    readonly_fields = ('generated_at', 'created_at', 'updated_at', 'rows_count', 'summary', 'payload')


@admin.register(ReportSchedule)
class ReportScheduleAdmin(admin.ModelAdmin):
    list_display = ('name', 'report_type', 'frequency', 'next_run_at', 'is_active', 'last_run_at')
    list_filter = ('report_type', 'frequency', 'is_active')
    search_fields = ('name', 'report_type')


@admin.register(DataGovernancePolicy)
class DataGovernancePolicyAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'audit_retention_days',
        'chat_retention_days',
        'report_retention_days',
        'backup_enabled',
        'backup_frequency',
    )


@admin.register(RoleAlertPolicy)
class RoleAlertPolicyAdmin(admin.ModelAdmin):
    list_display = ('role', 'metric_key', 'warning_threshold', 'critical_threshold', 'is_active')
    list_filter = ('role', 'is_active')
    search_fields = ('role', 'metric_key')


@admin.register(RiskFlag)
class RiskFlagAdmin(admin.ModelAdmin):
    list_display = ('detected_at', 'flag_type', 'severity', 'status', 'user', 'student')
    list_filter = ('flag_type', 'severity', 'status')
    search_fields = ('flag_type', 'reason', 'user__username', 'student__user__username')


@admin.register(ApprovalRequest)
class ApprovalRequestAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'action_type', 'status', 'requested_by', 'target_user', 'reviewed_by')
    list_filter = ('action_type', 'status')
    search_fields = ('requested_by__username', 'target_user__username', 'reviewed_by__username')
