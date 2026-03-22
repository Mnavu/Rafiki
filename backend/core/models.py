from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.utils import timezone
import hashlib
import json
from uuid import uuid4


REPORT_TYPE_CHOICES = (
    ("user_access", "User Access"),
    ("academic_delivery", "Academic Delivery"),
    ("assessment_pipeline", "Assessment Pipeline"),
    ("communication_sla", "Communication SLA"),
    ("finance_registration", "Finance and Registration"),
    ("risk_flags", "Risk Flags"),
    ("audit_summary", "Audit Summary"),
)

REPORT_FORMAT_CHOICES = (
    ("json", "JSON"),
    ("csv", "CSV"),
)

REPORT_FREQUENCY_CHOICES = (
    ("daily", "Daily"),
    ("weekly", "Weekly"),
    ("monthly", "Monthly"),
)


class Department(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=10, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    head_of_department = models.ForeignKey(
        'users.HOD',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='headed_department'
    )

    def __str__(self):
        return f"{self.name} ({self.code})"


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class AuditLog(models.Model):
    event_id = models.UUIDField(default=uuid4, editable=False, db_index=True)
    actor_user = models.ForeignKey(
        "users.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )
    action = models.CharField(max_length=255, default='')
    target_table = models.CharField(max_length=128, default='')
    target_id = models.CharField(max_length=64, default='')
    before = models.JSONField(default=dict, blank=True, null=True)
    after = models.JSONField(default=dict, blank=True, null=True)
    request_id = models.CharField(max_length=64, blank=True, default="")
    request_path = models.CharField(max_length=255, blank=True, default="")
    request_method = models.CharField(max_length=16, blank=True, default="")
    request_status = models.IntegerField(null=True, blank=True)
    ip_address = models.CharField(max_length=64, blank=True, default="")
    user_agent = models.CharField(max_length=512, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True, null=True)
    previous_hash = models.CharField(max_length=128, blank=True, default="")
    integrity_hash = models.CharField(max_length=128, blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["created_at"]),
            models.Index(fields=["action", "created_at"]),
            models.Index(fields=["target_table", "target_id"]),
            models.Index(fields=["actor_user", "created_at"]),
        ]

    def _build_hash_payload(self):
        payload = {
            "event_id": str(self.event_id),
            "actor_user_id": self.actor_user_id,
            "action": self.action,
            "target_table": self.target_table,
            "target_id": self.target_id,
            "before": self.before or {},
            "after": self.after or {},
            "request_id": self.request_id,
            "request_path": self.request_path,
            "request_method": self.request_method,
            "request_status": self.request_status,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "metadata": self.metadata or {},
            "created_at": self.created_at.isoformat() if self.created_at else "",
            "previous_hash": self.previous_hash or "",
        }
        raw = json.dumps(payload, sort_keys=True, cls=DjangoJSONEncoder)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def save(self, *args, **kwargs):
        allow_update = kwargs.pop("allow_update", False)
        if self.pk and not allow_update:
            raise ValidationError("AuditLog entries are immutable and cannot be updated.")
        if not self.pk:
            if not self.previous_hash:
                latest = AuditLog.objects.order_by("-created_at", "-id").first()
                self.previous_hash = latest.integrity_hash if latest else ""
            if not self.integrity_hash:
                self.integrity_hash = self._build_hash_payload()
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("AuditLog entries are immutable and cannot be deleted.")


class CalendarEvent(TimeStampedModel):
    owner_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="calendar_events",
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    timezone_hint = models.CharField(max_length=64, default="Africa/Nairobi")
    source_type = models.CharField(max_length=64, blank=True)
    source_id = models.CharField(max_length=64, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["start_at"]
        indexes = [
            models.Index(fields=["owner_user", "start_at"]),
            models.Index(fields=["source_type", "source_id"]),
        ]
        unique_together = ("owner_user", "source_type", "source_id")

    def __str__(self):
        return f"{self.title} ({self.owner_user_id})"


class DeviceRegistration(TimeStampedModel):
    PLATFORM_CHOICES = (
        ("expo", "Expo"),
        ("ios", "Apple"),
        ("android", "Android"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="device_registrations",
    )
    platform = models.CharField(max_length=32, choices=PLATFORM_CHOICES)
    push_token = models.CharField(max_length=255, unique=True)
    last_registered_at = models.DateTimeField(auto_now=True)
    app_id = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["-last_registered_at"]
        indexes = [models.Index(fields=["user", "platform"])]

    def __str__(self):
        return f"{self.user_id} - {self.platform}"


class DataBundleImport(TimeStampedModel):
    bundle_name = models.CharField(max_length=128, unique=True)
    bundle_sha256 = models.CharField(max_length=64)
    source_path = models.CharField(max_length=255, blank=True, default="")
    record_count = models.PositiveIntegerField(default=0)
    loaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-loaded_at", "-updated_at"]

    def __str__(self):
        return f"{self.bundle_name} ({self.bundle_sha256[:12]})"


class ReportSchedule(TimeStampedModel):
    name = models.CharField(max_length=255)
    report_type = models.CharField(max_length=64, choices=REPORT_TYPE_CHOICES)
    frequency = models.CharField(max_length=16, choices=REPORT_FREQUENCY_CHOICES, default="weekly")
    next_run_at = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_report_schedules",
    )
    recipients = models.JSONField(default=list, blank=True)
    scope = models.JSONField(default=dict, blank=True)
    last_run_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["is_active", "next_run_at"])]

    def __str__(self):
        return f"{self.name} ({self.report_type})"


class ReportRecord(TimeStampedModel):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        GENERATED = "generated", "Generated"
        FAILED = "failed", "Failed"

    name = models.CharField(max_length=255)
    report_type = models.CharField(max_length=64, choices=REPORT_TYPE_CHOICES)
    format = models.CharField(max_length=16, choices=REPORT_FORMAT_CHOICES, default="json")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.GENERATED)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="generated_reports",
    )
    schedule = models.ForeignKey(
        "core.ReportSchedule",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports",
    )
    scope = models.JSONField(default=dict, blank=True)
    summary = models.JSONField(default=dict, blank=True)
    payload = models.JSONField(default=list, blank=True)
    rows_count = models.PositiveIntegerField(default=0)
    generated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-generated_at", "-created_at"]
        indexes = [
            models.Index(fields=["report_type", "generated_at"]),
            models.Index(fields=["status", "generated_at"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.report_type})"


class DataGovernancePolicy(TimeStampedModel):
    name = models.CharField(max_length=128, default="default")
    audit_retention_days = models.PositiveIntegerField(default=365)
    chat_retention_days = models.PositiveIntegerField(default=365)
    report_retention_days = models.PositiveIntegerField(default=365)
    backup_enabled = models.BooleanField(default=True)
    backup_frequency = models.CharField(max_length=16, choices=REPORT_FREQUENCY_CHOICES, default="weekly")
    backup_location = models.CharField(max_length=255, blank=True, default="")
    immutable_audit_enabled = models.BooleanField(default=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"Governance policy ({self.name})"


class RoleAlertPolicy(TimeStampedModel):
    role = models.CharField(max_length=32)
    metric_key = models.CharField(max_length=64)
    warning_threshold = models.FloatField(default=0)
    critical_threshold = models.FloatField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("role", "metric_key")
        ordering = ["role", "metric_key"]

    def __str__(self):
        return f"{self.role} - {self.metric_key}"


class RiskFlag(TimeStampedModel):
    class Severity(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"
        CRITICAL = "critical", "Critical"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ACKNOWLEDGED = "acknowledged", "Acknowledged"
        RESOLVED = "resolved", "Resolved"

    flag_type = models.CharField(max_length=64)
    severity = models.CharField(max_length=16, choices=Severity.choices, default=Severity.MEDIUM)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    reason = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="risk_flags",
    )
    student = models.ForeignKey(
        "users.Student",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="risk_flags",
    )
    programme = models.ForeignKey(
        "learning.Programme",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="risk_flags",
    )
    unit = models.ForeignKey(
        "learning.CurriculumUnit",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="risk_flags",
    )
    detected_at = models.DateTimeField(default=timezone.now)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="acknowledged_risk_flags",
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="resolved_risk_flags",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-detected_at", "-created_at"]
        indexes = [
            models.Index(fields=["status", "severity"]),
            models.Index(fields=["flag_type", "detected_at"]),
        ]

    def __str__(self):
        return f"{self.flag_type} ({self.severity})"


class ApprovalRequest(TimeStampedModel):
    class ActionType(models.TextChoices):
        ASSIGN_ROLE = "assign_role", "Assign Role"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    action_type = models.CharField(max_length=64, choices=ActionType.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="approval_requests_created",
    )
    target_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approval_requests_targeted",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="approval_requests_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    payload = models.JSONField(default=dict)
    comment = models.TextField(blank=True)
    approved_payload = models.JSONField(default=dict, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "action_type", "created_at"]),
            models.Index(fields=["requested_by", "status"]),
        ]

    def __str__(self):
        return f"{self.action_type} - {self.status}"
