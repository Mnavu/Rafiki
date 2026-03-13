from rest_framework import serializers
from django.contrib.auth import get_user_model
from core.models import (
    ApprovalRequest,
    AuditLog,
    CalendarEvent,
    DataGovernancePolicy,
    Department,
    DeviceRegistration,
    ReportRecord,
    ReportSchedule,
    RiskFlag,
    RoleAlertPolicy,
)
from users.models import HOD

User = get_user_model()


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'code']

class HODSerializer(serializers.ModelSerializer):
    department = DepartmentSerializer(read_only=True)
    class Meta:
        model = HOD
        fields = ['user', 'department']


class CalendarEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarEvent
        fields = [
            "id",
            "owner_user",
            "title",
            "description",
            "start_at",
            "end_at",
            "timezone_hint",
            "source_type",
            "source_id",
            "metadata",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class DeviceRegistrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceRegistration
        fields = ["platform", "push_token", "app_id"]


class AuditLogSerializer(serializers.ModelSerializer):
    actor_user_detail = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "event_id",
            "created_at",
            "actor_user",
            "actor_user_detail",
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
        ]

    def get_actor_user_detail(self, obj):
        if not obj.actor_user_id:
            return None
        user = obj.actor_user
        return {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name or user.username,
            "role": user.role,
        }


class ReportScheduleSerializer(serializers.ModelSerializer):
    created_by_detail = serializers.SerializerMethodField()

    class Meta:
        model = ReportSchedule
        fields = [
            "id",
            "name",
            "report_type",
            "frequency",
            "next_run_at",
            "is_active",
            "created_by",
            "created_by_detail",
            "recipients",
            "scope",
            "last_run_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_by", "created_by_detail", "last_run_at", "created_at", "updated_at"]

    def get_created_by_detail(self, obj):
        if not obj.created_by_id:
            return None
        user = obj.created_by
        return {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name or user.username,
            "role": user.role,
        }


class ReportRecordSerializer(serializers.ModelSerializer):
    generated_by_detail = serializers.SerializerMethodField()
    schedule_detail = ReportScheduleSerializer(source="schedule", read_only=True)

    class Meta:
        model = ReportRecord
        fields = [
            "id",
            "name",
            "report_type",
            "format",
            "status",
            "generated_by",
            "generated_by_detail",
            "schedule",
            "schedule_detail",
            "scope",
            "summary",
            "payload",
            "rows_count",
            "generated_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "generated_by",
            "generated_by_detail",
            "schedule_detail",
            "summary",
            "payload",
            "rows_count",
            "generated_at",
            "created_at",
            "updated_at",
        ]

    def get_generated_by_detail(self, obj):
        if not obj.generated_by_id:
            return None
        user = obj.generated_by
        return {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name or user.username,
            "role": user.role,
        }


class DataGovernancePolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = DataGovernancePolicy
        fields = [
            "id",
            "name",
            "audit_retention_days",
            "chat_retention_days",
            "report_retention_days",
            "backup_enabled",
            "backup_frequency",
            "backup_location",
            "immutable_audit_enabled",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class RoleAlertPolicySerializer(serializers.ModelSerializer):
    class Meta:
        model = RoleAlertPolicy
        fields = [
            "id",
            "role",
            "metric_key",
            "warning_threshold",
            "critical_threshold",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class RiskFlagSerializer(serializers.ModelSerializer):
    user_detail = serializers.SerializerMethodField()
    student_detail = serializers.SerializerMethodField()
    acknowledged_by_detail = serializers.SerializerMethodField()
    resolved_by_detail = serializers.SerializerMethodField()

    class Meta:
        model = RiskFlag
        fields = [
            "id",
            "flag_type",
            "severity",
            "status",
            "reason",
            "metadata",
            "user",
            "user_detail",
            "student",
            "student_detail",
            "programme",
            "unit",
            "detected_at",
            "acknowledged_by",
            "acknowledged_by_detail",
            "acknowledged_at",
            "resolved_by",
            "resolved_by_detail",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "detected_at",
            "acknowledged_by",
            "acknowledged_by_detail",
            "acknowledged_at",
            "resolved_by",
            "resolved_by_detail",
            "resolved_at",
            "created_at",
            "updated_at",
        ]

    def _serialize_user(self, user):
        if not user:
            return None
        return {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name or user.username,
            "role": user.role,
        }

    def get_user_detail(self, obj):
        return self._serialize_user(obj.user)

    def get_student_detail(self, obj):
        if not obj.student_id:
            return None
        user = obj.student.user
        return {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name or user.username,
            "year": obj.student.year,
            "trimester": obj.student.trimester,
        }

    def get_acknowledged_by_detail(self, obj):
        return self._serialize_user(obj.acknowledged_by)

    def get_resolved_by_detail(self, obj):
        return self._serialize_user(obj.resolved_by)


class ApprovalRequestSerializer(serializers.ModelSerializer):
    requested_by_detail = serializers.SerializerMethodField()
    target_user_detail = serializers.SerializerMethodField()
    reviewed_by_detail = serializers.SerializerMethodField()

    class Meta:
        model = ApprovalRequest
        fields = [
            "id",
            "action_type",
            "status",
            "requested_by",
            "requested_by_detail",
            "target_user",
            "target_user_detail",
            "reviewed_by",
            "reviewed_by_detail",
            "reviewed_at",
            "payload",
            "comment",
            "approved_payload",
            "expires_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "status",
            "requested_by",
            "requested_by_detail",
            "reviewed_by",
            "reviewed_by_detail",
            "reviewed_at",
            "approved_payload",
            "created_at",
            "updated_at",
        ]

    def _serialize_user(self, user):
        if not user:
            return None
        return {
            "id": user.id,
            "username": user.username,
            "display_name": user.display_name or user.username,
            "role": user.role,
        }

    def get_requested_by_detail(self, obj):
        return self._serialize_user(obj.requested_by)

    def get_target_user_detail(self, obj):
        return self._serialize_user(obj.target_user)

    def get_reviewed_by_detail(self, obj):
        return self._serialize_user(obj.reviewed_by)
