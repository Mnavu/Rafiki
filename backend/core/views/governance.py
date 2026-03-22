from __future__ import annotations

import csv
import io
import textwrap
from datetime import timedelta
from typing import Any

from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from communications.models import Thread
from finance.models import FinanceStatus
from learning.models import Assignment, Registration, Submission
from users.models import User
from users.role_assignment import apply_user_role

from core.audit import create_audit_event
from core.models import (
    ApprovalRequest,
    AuditLog,
    DataGovernancePolicy,
    REPORT_FORMAT_CHOICES,
    REPORT_TYPE_CHOICES,
    ReportRecord,
    ReportSchedule,
    RiskFlag,
    RoleAlertPolicy,
)
from core.serializers import (
    ApprovalRequestSerializer,
    AuditLogSerializer,
    DataGovernancePolicySerializer,
    ReportRecordSerializer,
    ReportScheduleSerializer,
    RiskFlagSerializer,
    RoleAlertPolicySerializer,
)


MANAGER_ROLES = {User.Roles.ADMIN, User.Roles.SUPERADMIN, User.Roles.RECORDS}
REPORT_TYPES = {choice[0] for choice in REPORT_TYPE_CHOICES}
REPORT_FORMATS = {choice[0] for choice in REPORT_FORMAT_CHOICES}
CLIENT_ACTIVITY_ACTIONS = {
    "page_open": "ui_page_open",
    "click": "ui_click",
}


def _is_manager(user: User) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser or user.is_staff:
        return True
    return user.role in MANAGER_ROLES


def _require_manager(user: User) -> None:
    if not _is_manager(user):
        raise PermissionDenied("Only admin, superadmin, or records users can access governance APIs.")


def _build_user_brief(user: User | None) -> dict[str, Any] | None:
    if not user:
        return None
    return {
        "id": user.id,
        "username": user.username,
        "display_name": user.display_name or user.username,
        "role": user.role,
    }


def _to_rows_for_csv(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        rows = []
        for key, value in payload.items():
            if isinstance(value, dict):
                row = {"section": key}
                row.update(value)
                rows.append(row)
            else:
                rows.append({"section": key, "value": value})
        return rows
    return [{"value": str(payload)}]


def build_tabulations_snapshot() -> dict[str, Any]:
    now = timezone.now()
    week_ago = now - timedelta(days=7)

    total_users = User.objects.count()
    active_last_week = User.objects.filter(last_login__gte=week_ago).count()
    role_rows = User.objects.values("role").annotate(total=Count("id")).order_by("role")

    pending_registrations = Registration.objects.filter(status=Registration.Status.PENDING_HOD).count()
    approved_registrations = Registration.objects.filter(status=Registration.Status.APPROVED).count()
    blocked_finance = FinanceStatus.objects.filter(
        clearance_status=FinanceStatus.Clearance.BLOCKED
    ).count()

    total_submissions = Submission.objects.count()
    ungraded_submissions = Submission.objects.filter(grade__isnull=True).count()
    pending_to_grade_ratio = (
        round((ungraded_submissions / total_submissions) * 100, 2) if total_submissions else 0
    )

    unresolved_threads_24h = 0
    unresolved_threads_48h = 0
    for thread in Thread.objects.prefetch_related("messages"):
        last_message = thread.messages.order_by("-created_at").first()
        if not last_message:
            continue
        age_hours = (now - last_message.created_at).total_seconds() / 3600
        if age_hours >= 24:
            unresolved_threads_24h += 1
        if age_hours >= 48:
            unresolved_threads_48h += 1

    open_approvals = ApprovalRequest.objects.filter(status=ApprovalRequest.Status.PENDING).count()
    open_risk_flags = RiskFlag.objects.filter(status=RiskFlag.Status.OPEN).count()
    critical_risk_flags = RiskFlag.objects.filter(
        status=RiskFlag.Status.OPEN,
        severity=RiskFlag.Severity.CRITICAL,
    ).count()

    return {
        "generated_at": now.isoformat(),
        "user_access": {
            "total_users": total_users,
            "active_last_7_days": active_last_week,
            "role_breakdown": list(role_rows),
        },
        "academic_delivery": {
            "pending_registrations": pending_registrations,
            "approved_registrations": approved_registrations,
            "current_assignments": Assignment.objects.count(),
        },
        "assessment_pipeline": {
            "total_submissions": total_submissions,
            "ungraded_submissions": ungraded_submissions,
            "pending_to_grade_ratio_percent": pending_to_grade_ratio,
        },
        "communication_sla": {
            "unresolved_threads_24h": unresolved_threads_24h,
            "unresolved_threads_48h": unresolved_threads_48h,
        },
        "finance_registration": {
            "blocked_finance_students": blocked_finance,
            "pending_hod_approvals": pending_registrations,
        },
        "governance": {
            "pending_approval_requests": open_approvals,
            "open_risk_flags": open_risk_flags,
            "critical_risk_flags": critical_risk_flags,
        },
    }


def _build_report_payload(
    report_type: str, scope: dict[str, Any] | None = None
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    scope = scope or {}
    snapshot = build_tabulations_snapshot()
    generated_at = timezone.now().isoformat()

    if report_type == "user_access":
        payload = snapshot["user_access"]["role_breakdown"]
        summary = {
            "generated_at": generated_at,
            "total_users": snapshot["user_access"]["total_users"],
            "active_last_7_days": snapshot["user_access"]["active_last_7_days"],
        }
        return payload, summary

    if report_type == "academic_delivery":
        payload = [
            {
                "metric": "pending_registrations",
                "value": snapshot["academic_delivery"]["pending_registrations"],
            },
            {
                "metric": "approved_registrations",
                "value": snapshot["academic_delivery"]["approved_registrations"],
            },
            {
                "metric": "current_assignments",
                "value": snapshot["academic_delivery"]["current_assignments"],
            },
        ]
        return payload, {"generated_at": generated_at}

    if report_type == "assessment_pipeline":
        return [snapshot["assessment_pipeline"]], {"generated_at": generated_at}

    if report_type == "communication_sla":
        return [snapshot["communication_sla"]], {"generated_at": generated_at}

    if report_type == "finance_registration":
        return [snapshot["finance_registration"]], {"generated_at": generated_at}

    if report_type == "risk_flags":
        flags = RiskFlag.objects.filter(status=RiskFlag.Status.OPEN).select_related(
            "user",
            "student__user",
            "programme",
            "unit",
        )
        payload = [
            {
                "id": flag.id,
                "flag_type": flag.flag_type,
                "severity": flag.severity,
                "reason": flag.reason,
                "user": flag.user.display_name if flag.user_id else None,
                "student": flag.student.user.display_name if flag.student_id else None,
                "programme": flag.programme.name if flag.programme_id else None,
                "unit": flag.unit.code if flag.unit_id else None,
                "detected_at": flag.detected_at.isoformat(),
            }
            for flag in flags
        ]
        return payload, {"generated_at": generated_at, "open_risk_flags": len(payload)}

    if report_type == "audit_summary":
        days = int(scope.get("days") or 7)
        window_start = timezone.now() - timedelta(days=max(days, 1))
        rows = (
            AuditLog.objects.filter(created_at__gte=window_start)
            .values("action")
            .annotate(total=Count("id"))
            .order_by("-total")
        )
        return list(rows), {"generated_at": generated_at, "days": days}

    raise ValidationError({"detail": f"Unsupported report_type '{report_type}'."})


def _build_csv_response(report_name: str, payload: Any) -> HttpResponse:
    rows = _to_rows_for_csv(payload)
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=sorted({key for row in rows for key in row.keys()}))
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    response = HttpResponse(output.getvalue(), content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{report_name}.csv"'
    return response


def _pdf_safe_text(value: Any) -> str:
    text = "" if value is None else str(value)
    text = " ".join(text.replace("\r", " ").replace("\n", " ").replace("\t", " ").split())
    return text.encode("latin-1", "replace").decode("latin-1")


def _escape_pdf_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_pdf_response(report_name: str, title: str, lines: list[str]) -> HttpResponse:
    page_width = 595
    page_height = 842
    margin_left = 48
    margin_top = 800
    title_gap = 20
    line_gap = 14
    max_chars = 92
    max_lines_per_page = 46

    wrapped_lines: list[str] = []
    for line in lines:
        normalized = _pdf_safe_text(line)
        parts = textwrap.wrap(normalized, width=max_chars) or [normalized or " "]
        wrapped_lines.extend(parts)

    pages: list[list[str]] = [
        wrapped_lines[index : index + max_lines_per_page]
        for index in range(0, len(wrapped_lines), max_lines_per_page)
    ] or [[]]

    font_object_id = 3 + (len(pages) * 2)
    objects: list[bytes] = []

    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")

    page_ids = [3 + (index * 2) for index in range(len(pages))]
    kids = " ".join(f"{page_id} 0 R" for page_id in page_ids)
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode("latin-1"))

    for index, page_lines in enumerate(pages, start=1):
        page_object_id = 3 + ((index - 1) * 2)
        content_object_id = page_object_id + 1
        page_title = _escape_pdf_text(_pdf_safe_text(f"{title} (Page {index} of {len(pages)})"))
        stream_lines = [
            "BT",
            f"/F1 12 Tf {margin_left} {margin_top} Td ({page_title}) Tj",
            f"0 -{title_gap} Td",
            "/F1 9 Tf",
        ]
        for line in page_lines:
            stream_lines.append(f"({_escape_pdf_text(_pdf_safe_text(line))}) Tj")
            stream_lines.append(f"0 -{line_gap} Td")
        stream_lines.append("ET")
        stream = "\n".join(stream_lines).encode("latin-1")

        objects.append(
            (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {page_width} {page_height}] "
                f"/Resources << /Font << /F1 {font_object_id} 0 R >> >> "
                f"/Contents {content_object_id} 0 R >>"
            ).encode("latin-1")
        )
        objects.append(
            b"<< /Length "
            + str(len(stream)).encode("latin-1")
            + b" >>\nstream\n"
            + stream
            + b"\nendstream"
        )

    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    header = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    body = bytearray(header)
    offsets = [0]
    for index, obj in enumerate(objects, start=1):
        offsets.append(len(body))
        body.extend(f"{index} 0 obj\n".encode("latin-1"))
        body.extend(obj)
        body.extend(b"\nendobj\n")

    xref_start = len(body)
    body.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    body.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        body.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))
    body.extend(
        (
            f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_start}\n%%EOF"
        ).encode("latin-1")
    )

    response = HttpResponse(bytes(body), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{report_name}.pdf"'
    return response


def _serialize_audit_logs(queryset) -> list[dict[str, Any]]:
    return [
        {
            "created_at": row.created_at.isoformat(),
            "actor_username": row.actor_user.username if row.actor_user_id else "",
            "actor_display_name": (
                row.actor_user.display_name if row.actor_user_id else ""
            ) or (row.actor_user.username if row.actor_user_id else ""),
            "actor_role": row.actor_user.role if row.actor_user_id else "",
            "action": row.action,
            "target_table": row.target_table,
            "target_id": row.target_id,
            "request_method": row.request_method,
            "request_path": row.request_path,
            "request_status": row.request_status,
            "request_id": row.request_id,
            "ip_address": row.ip_address,
            "user_agent": row.user_agent,
            "screen": (row.metadata or {}).get("screen", ""),
            "label": (row.metadata or {}).get("label", ""),
            "component": (row.metadata or {}).get("component", ""),
        }
        for row in queryset
    ]


def _refresh_risk_flags(actor: User | None = None) -> list[RiskFlag]:
    now = timezone.now()
    flags: list[RiskFlag] = []

    RiskFlag.objects.filter(
        status=RiskFlag.Status.OPEN,
        metadata__source="system",
    ).delete()

    blocked_finance = FinanceStatus.objects.filter(
        clearance_status=FinanceStatus.Clearance.BLOCKED
    ).select_related("student__user", "student__programme")
    for row in blocked_finance:
        flag = RiskFlag.objects.create(
            flag_type="finance_block",
            severity=RiskFlag.Severity.HIGH,
            reason="Student is currently blocked by finance clearance.",
            metadata={"source": "system", "finance_status_id": row.id},
            student=row.student,
            user=row.student.user if row.student_id else None,
            programme=row.student.programme if row.student_id else None,
            detected_at=now,
        )
        flags.append(flag)

    approved_regs = Registration.objects.filter(status=Registration.Status.APPROVED).select_related(
        "student__user",
        "student__programme",
        "unit",
    )
    for reg in approved_regs:
        if not reg.student_id or not reg.unit_id:
            continue
        assignments = Assignment.objects.filter(unit_id=reg.unit_id, due_at__lte=now)
        total_assignments = assignments.count()
        if total_assignments < 3:
            continue
        submissions = Submission.objects.filter(
            assignment__in=assignments,
            student=reg.student,
        ).count()
        completion_ratio = submissions / total_assignments if total_assignments else 0
        if completion_ratio < 0.5:
            severity = RiskFlag.Severity.CRITICAL if completion_ratio < 0.3 else RiskFlag.Severity.MEDIUM
            flag = RiskFlag.objects.create(
                flag_type="assessment_completion_risk",
                severity=severity,
                reason="Student assessment completion ratio is below the expected threshold.",
                metadata={
                    "source": "system",
                    "registration_id": reg.id,
                    "completion_ratio": round(completion_ratio, 2),
                    "assignments_due": total_assignments,
                    "submitted": submissions,
                },
                student=reg.student,
                user=reg.student.user,
                programme=reg.student.programme,
                unit=reg.unit,
                detected_at=now,
            )
            flags.append(flag)

    unresolved_by_lecturer: dict[int, int] = {}
    for thread in Thread.objects.prefetch_related("messages"):
        last_message = thread.messages.order_by("-created_at").first()
        if not last_message:
            continue
        age_hours = (now - last_message.created_at).total_seconds() / 3600
        if age_hours < 48 or not thread.teacher_id:
            continue
        unresolved_by_lecturer.setdefault(thread.teacher_id, 0)
        unresolved_by_lecturer[thread.teacher_id] += 1

    for lecturer_user_id, count in unresolved_by_lecturer.items():
        if count < 5:
            continue
        lecturer_user = User.objects.filter(pk=lecturer_user_id).first()
        if not lecturer_user:
            continue
        severity = RiskFlag.Severity.HIGH if count < 10 else RiskFlag.Severity.CRITICAL
        flag = RiskFlag.objects.create(
            flag_type="communication_backlog",
            severity=severity,
            reason="Lecturer has unresolved thread backlog beyond SLA.",
            metadata={"source": "system", "unresolved_threads_48h": count},
            user=lecturer_user,
            detected_at=now,
        )
        flags.append(flag)

    if actor:
        AuditLog.objects.create(
            actor_user=actor,
            action="risk_flags_refreshed",
            target_table="core.RiskFlag",
            target_id="bulk",
            after={"created_flags": len(flags)},
        )
    return flags


class ManagerPermission(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        return _is_manager(request.user)


class ActivityEventView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        request._skip_api_audit = True

        event_type = str(request.data.get("event_type") or "").strip().lower()
        action = CLIENT_ACTIVITY_ACTIONS.get(event_type)
        if not action:
            raise ValidationError({"event_type": "Unsupported activity event type."})

        label = str(request.data.get("label") or "").strip()
        screen = str(request.data.get("screen") or "").strip()
        component = str(request.data.get("component") or "").strip()
        target = str(request.data.get("target") or label or screen or event_type).strip()[:64]
        raw_metadata = request.data.get("metadata") or {}
        if raw_metadata and not isinstance(raw_metadata, dict):
            raise ValidationError({"metadata": "Metadata must be an object."})

        metadata = {
            "event_type": event_type,
            "label": label[:255],
            "screen": screen[:128],
            "component": component[:64],
            **raw_metadata,
        }

        row = create_audit_event(
            actor=request.user,
            action=action,
            target_table="frontend.ui",
            target_id=target,
            metadata=metadata,
            after={
                "event_type": event_type,
                "label": label[:255],
                "screen": screen[:128],
                "component": component[:64],
            },
            request_status=status.HTTP_201_CREATED,
        )
        return Response(
            {
                "id": row.id,
                "event_id": str(row.event_id),
                "action": row.action,
            },
            status=status.HTTP_201_CREATED,
        )


class GovernanceTabulationsView(APIView):
    permission_classes = [permissions.IsAuthenticated, ManagerPermission]

    def get(self, request):
        snapshot = build_tabulations_snapshot()
        tabulations = [
            {"key": "user_access", "label": "User Access", "value": snapshot["user_access"]["total_users"]},
            {
                "key": "academic_pending",
                "label": "Pending Registrations",
                "value": snapshot["academic_delivery"]["pending_registrations"],
            },
            {
                "key": "assessment_ungraded",
                "label": "Ungraded Submissions",
                "value": snapshot["assessment_pipeline"]["ungraded_submissions"],
            },
            {
                "key": "sla_48h",
                "label": "Threads over 48h",
                "value": snapshot["communication_sla"]["unresolved_threads_48h"],
            },
            {
                "key": "finance_blocked",
                "label": "Finance Blocked",
                "value": snapshot["finance_registration"]["blocked_finance_students"],
            },
            {
                "key": "risk_open",
                "label": "Open Risk Flags",
                "value": snapshot["governance"]["open_risk_flags"],
            },
        ]
        return Response({"snapshot": snapshot, "tabulations": tabulations})


class GovernanceActivityTimelineView(APIView):
    permission_classes = [permissions.IsAuthenticated, ManagerPermission]

    def get(self, request):
        limit = int(request.query_params.get("limit", 50))
        limit = min(max(limit, 10), 200)

        timeline: list[dict[str, Any]] = []

        for row in AuditLog.objects.select_related("actor_user").order_by("-created_at")[:limit]:
            description = f"{row.target_table}#{row.target_id}"
            if row.action in {"ui_page_open", "ui_click"}:
                label = (row.metadata or {}).get("label")
                screen = (row.metadata or {}).get("screen")
                component = (row.metadata or {}).get("component")
                description = " | ".join(
                    part for part in [str(screen or "").strip(), str(component or "").strip(), str(label or row.target_id).strip()] if part
                )
            elif row.action == "chatbot_question_asked":
                description = str((row.metadata or {}).get("query") or row.target_id)
            elif row.action == "chatbot_feedback_submitted":
                rating = str((row.metadata or {}).get("rating") or "").strip()
                description = " | ".join(part for part in [row.target_id, rating] if part)
            timeline.append(
                {
                    "id": f"audit-{row.id}",
                    "kind": "audit",
                    "timestamp": row.created_at.isoformat(),
                    "title": row.action,
                    "description": description,
                    "actor": _build_user_brief(row.actor_user),
                    "metadata": {
                        "target_table": row.target_table,
                        "target_id": row.target_id,
                        "request_path": row.request_path,
                        "request_status": row.request_status,
                    },
                }
            )

        for row in ReportRecord.objects.select_related("generated_by").order_by("-generated_at")[:limit]:
            timeline.append(
                {
                    "id": f"report-{row.id}",
                    "kind": "report",
                    "timestamp": row.generated_at.isoformat(),
                    "title": row.name,
                    "description": f"{row.report_type} ({row.format})",
                    "actor": _build_user_brief(row.generated_by),
                    "metadata": {"status": row.status, "rows_count": row.rows_count},
                }
            )

        for row in ApprovalRequest.objects.select_related("requested_by", "reviewed_by").order_by("-created_at")[:limit]:
            timeline.append(
                {
                    "id": f"approval-{row.id}",
                    "kind": "approval",
                    "timestamp": row.updated_at.isoformat(),
                    "title": f"{row.action_type} - {row.status}",
                    "description": f"Target user: {row.target_user_id or 'n/a'}",
                    "actor": _build_user_brief(row.reviewed_by or row.requested_by),
                    "metadata": {"status": row.status, "payload": row.payload},
                }
            )

        for row in RiskFlag.objects.select_related("user").order_by("-detected_at")[:limit]:
            timeline.append(
                {
                    "id": f"risk-{row.id}",
                    "kind": "risk",
                    "timestamp": row.detected_at.isoformat(),
                    "title": f"{row.flag_type} ({row.severity})",
                    "description": row.reason[:180],
                    "actor": _build_user_brief(row.user),
                    "metadata": {"status": row.status},
                }
            )

        sorted_timeline = sorted(
            timeline,
            key=lambda item: item.get("timestamp", ""),
            reverse=True,
        )[:limit]
        return Response({"items": sorted_timeline, "count": len(sorted_timeline)})


class GovernanceReportViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ReportRecordSerializer
    permission_classes = [permissions.IsAuthenticated, ManagerPermission]

    def get_queryset(self):
        queryset = ReportRecord.objects.select_related("generated_by", "schedule").order_by("-generated_at")
        report_type = self.request.query_params.get("report_type")
        if report_type:
            queryset = queryset.filter(report_type=report_type)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset

    @action(detail=False, methods=["post"], url_path="generate")
    def generate(self, request):
        _require_manager(request.user)
        report_type = request.data.get("report_type")
        if report_type not in REPORT_TYPES:
            raise ValidationError({"report_type": "Unsupported report type."})
        report_format = request.data.get("format") or "json"
        if report_format not in REPORT_FORMATS:
            raise ValidationError({"format": "Unsupported report format."})

        name = (request.data.get("name") or "").strip()
        if not name:
            name = f"{report_type.replace('_', ' ').title()} Report"

        scope = request.data.get("scope") or {}
        if not isinstance(scope, dict):
            raise ValidationError({"scope": "Scope must be an object."})

        schedule_id = request.data.get("schedule_id")
        schedule = None
        if schedule_id:
            schedule = ReportSchedule.objects.filter(pk=schedule_id).first()

        payload, summary = _build_report_payload(report_type, scope)
        record = ReportRecord.objects.create(
            name=name,
            report_type=report_type,
            format=report_format,
            generated_by=request.user,
            schedule=schedule,
            scope=scope,
            summary=summary,
            payload=payload,
            rows_count=len(payload),
            status=ReportRecord.Status.GENERATED,
        )
        if schedule:
            schedule.last_run_at = timezone.now()
            schedule.next_run_at = schedule.last_run_at
            schedule.save(update_fields=["last_run_at", "next_run_at"])

        AuditLog.objects.create(
            actor_user=request.user,
            action="report_generated",
            target_table=ReportRecord._meta.label,
            target_id=str(record.id),
            after={
                "report_type": record.report_type,
                "format": record.format,
                "rows_count": record.rows_count,
            },
        )

        return Response(self.get_serializer(record).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="download-csv")
    def download_csv(self, request, pk=None):
        _require_manager(request.user)
        record = self.get_object()
        return _build_csv_response(f"report-{record.id}", record.payload)


class ReportScheduleViewSet(viewsets.ModelViewSet):
    serializer_class = ReportScheduleSerializer
    permission_classes = [permissions.IsAuthenticated, ManagerPermission]

    def get_queryset(self):
        queryset = ReportSchedule.objects.select_related("created_by").order_by("-created_at")
        report_type = self.request.query_params.get("report_type")
        if report_type:
            queryset = queryset.filter(report_type=report_type)
        if self.request.query_params.get("active") == "1":
            queryset = queryset.filter(is_active=True)
        return queryset

    def perform_create(self, serializer):
        schedule = serializer.save(created_by=self.request.user)
        AuditLog.objects.create(
            actor_user=self.request.user,
            action="report_schedule_created",
            target_table=ReportSchedule._meta.label,
            target_id=str(schedule.id),
            after=serializer.data,
        )

    def perform_update(self, serializer):
        existing = self.get_object()
        before = {
            "name": existing.name,
            "report_type": existing.report_type,
            "frequency": existing.frequency,
            "next_run_at": existing.next_run_at.isoformat() if existing.next_run_at else None,
            "is_active": existing.is_active,
            "scope": existing.scope,
        }
        schedule = serializer.save()
        AuditLog.objects.create(
            actor_user=self.request.user,
            action="report_schedule_updated",
            target_table=ReportSchedule._meta.label,
            target_id=str(schedule.id),
            before=before,
            after=serializer.data,
        )

    def perform_destroy(self, instance):
        before = {
            "name": instance.name,
            "report_type": instance.report_type,
            "frequency": instance.frequency,
            "next_run_at": instance.next_run_at.isoformat() if instance.next_run_at else None,
            "is_active": instance.is_active,
        }
        schedule_id = instance.id
        instance.delete()
        AuditLog.objects.create(
            actor_user=self.request.user,
            action="report_schedule_deleted",
            target_table=ReportSchedule._meta.label,
            target_id=str(schedule_id),
            before=before,
        )

    @action(detail=True, methods=["post"], url_path="run-now")
    def run_now(self, request, pk=None):
        schedule = self.get_object()
        payload, summary = _build_report_payload(schedule.report_type, schedule.scope or {})
        record = ReportRecord.objects.create(
            name=f"{schedule.name} ({timezone.now().date().isoformat()})",
            report_type=schedule.report_type,
            format="json",
            generated_by=request.user,
            schedule=schedule,
            scope=schedule.scope or {},
            summary=summary,
            payload=payload,
            rows_count=len(payload),
            status=ReportRecord.Status.GENERATED,
        )
        schedule.last_run_at = timezone.now()
        schedule.next_run_at = schedule.last_run_at
        schedule.save(update_fields=["last_run_at", "next_run_at"])
        AuditLog.objects.create(
            actor_user=request.user,
            action="report_schedule_run",
            target_table=ReportSchedule._meta.label,
            target_id=str(schedule.id),
            after={"report_record_id": record.id},
        )
        return Response(
            {
                "detail": "Scheduled report executed.",
                "report_record_id": record.id,
            },
            status=status.HTTP_200_OK,
        )


class DataGovernancePolicyView(APIView):
    permission_classes = [permissions.IsAuthenticated, ManagerPermission]

    def get(self, request):
        policy = DataGovernancePolicy.objects.order_by("-updated_at").first()
        if not policy:
            policy = DataGovernancePolicy.objects.create(name="default")
        return Response(DataGovernancePolicySerializer(policy).data)

    def put(self, request):
        policy = DataGovernancePolicy.objects.order_by("-updated_at").first()
        if not policy:
            serializer = DataGovernancePolicySerializer(data=request.data)
        else:
            serializer = DataGovernancePolicySerializer(policy, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        saved = serializer.save()
        AuditLog.objects.create(
            actor_user=request.user,
            action="governance_policy_updated",
            target_table=DataGovernancePolicy._meta.label,
            target_id=str(saved.id),
            after=serializer.data,
        )
        return Response(serializer.data)


class RoleAlertPolicyViewSet(viewsets.ModelViewSet):
    serializer_class = RoleAlertPolicySerializer
    permission_classes = [permissions.IsAuthenticated, ManagerPermission]
    queryset = RoleAlertPolicy.objects.order_by("role", "metric_key")

    def get_queryset(self):
        queryset = super().get_queryset()
        role = self.request.query_params.get("role")
        if role:
            queryset = queryset.filter(role=role)
        metric_key = self.request.query_params.get("metric_key")
        if metric_key:
            queryset = queryset.filter(metric_key=metric_key)
        return queryset

    def perform_create(self, serializer):
        policy = serializer.save()
        AuditLog.objects.create(
            actor_user=self.request.user,
            action="role_alert_policy_created",
            target_table=RoleAlertPolicy._meta.label,
            target_id=str(policy.id),
            after=serializer.data,
        )

    def perform_update(self, serializer):
        existing = self.get_object()
        before = {
            "role": existing.role,
            "metric_key": existing.metric_key,
            "warning_threshold": existing.warning_threshold,
            "critical_threshold": existing.critical_threshold,
            "is_active": existing.is_active,
        }
        policy = serializer.save()
        AuditLog.objects.create(
            actor_user=self.request.user,
            action="role_alert_policy_updated",
            target_table=RoleAlertPolicy._meta.label,
            target_id=str(policy.id),
            before=before,
            after=serializer.data,
        )

    def perform_destroy(self, instance):
        before = {
            "role": instance.role,
            "metric_key": instance.metric_key,
            "warning_threshold": instance.warning_threshold,
            "critical_threshold": instance.critical_threshold,
            "is_active": instance.is_active,
        }
        policy_id = instance.id
        instance.delete()
        AuditLog.objects.create(
            actor_user=self.request.user,
            action="role_alert_policy_deleted",
            target_table=RoleAlertPolicy._meta.label,
            target_id=str(policy_id),
            before=before,
        )


class GovernanceAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, ManagerPermission]

    def get_queryset(self):
        queryset = AuditLog.objects.select_related("actor_user").order_by("-created_at")
        action_name = self.request.query_params.get("action")
        if action_name:
            queryset = queryset.filter(action=action_name)
        target_table = self.request.query_params.get("target_table")
        if target_table:
            queryset = queryset.filter(target_table=target_table)
        actor_user = self.request.query_params.get("actor_user")
        if actor_user:
            queryset = queryset.filter(actor_user_id=actor_user)
        request_status = self.request.query_params.get("request_status")
        if request_status:
            queryset = queryset.filter(request_status=request_status)
        query = self.request.query_params.get("q")
        if query:
            queryset = queryset.filter(
                Q(target_id__icontains=query)
                | Q(action__icontains=query)
                | Q(request_path__icontains=query)
            )
        return queryset

    @action(detail=False, methods=["get"], url_path="download-csv")
    def download_csv(self, request):
        _require_manager(request.user)
        queryset = self.filter_queryset(self.get_queryset())
        payload = _serialize_audit_logs(queryset)
        return _build_csv_response("audit-logs", payload)

    @action(detail=False, methods=["get"], url_path="download-pdf")
    def download_pdf(self, request):
        _require_manager(request.user)
        queryset = self.filter_queryset(self.get_queryset())
        lines = [
            "Audit log export",
            "",
        ]
        for row in _serialize_audit_logs(queryset):
            lines.append(
                " | ".join(
                    [
                        row["created_at"],
                        row["actor_display_name"] or row["actor_username"] or "System",
                        row["action"],
                        row["label"] or row["target_id"] or "n/a",
                        row["screen"] or row["request_path"] or "n/a",
                        str(row["request_status"] or ""),
                    ]
                )
            )
        return _build_pdf_response("audit-logs", "Audit Logs", lines)


class RiskFlagViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = RiskFlagSerializer
    permission_classes = [permissions.IsAuthenticated, ManagerPermission]
    queryset = RiskFlag.objects.select_related(
        "user",
        "student__user",
        "programme",
        "unit",
        "acknowledged_by",
        "resolved_by",
    ).order_by("-detected_at")

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        severity = self.request.query_params.get("severity")
        if severity:
            queryset = queryset.filter(severity=severity)
        flag_type = self.request.query_params.get("flag_type")
        if flag_type:
            queryset = queryset.filter(flag_type=flag_type)
        return queryset

    @action(detail=False, methods=["post"], url_path="refresh")
    def refresh(self, request):
        flags = _refresh_risk_flags(actor=request.user)
        serializer = self.get_serializer(flags, many=True)
        return Response(
            {
                "detail": "Risk flags refreshed.",
                "created_count": len(flags),
                "items": serializer.data,
            }
        )

    @action(detail=True, methods=["post"], url_path="acknowledge")
    def acknowledge(self, request, pk=None):
        flag = self.get_object()
        if flag.status == RiskFlag.Status.RESOLVED:
            raise ValidationError({"detail": "Resolved risk flags cannot be acknowledged."})
        flag.status = RiskFlag.Status.ACKNOWLEDGED
        flag.acknowledged_by = request.user
        flag.acknowledged_at = timezone.now()
        flag.save(update_fields=["status", "acknowledged_by", "acknowledged_at", "updated_at"])
        AuditLog.objects.create(
            actor_user=request.user,
            action="risk_flag_acknowledged",
            target_table=RiskFlag._meta.label,
            target_id=str(flag.id),
            after={"status": flag.status},
        )
        return Response(self.get_serializer(flag).data)

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        flag = self.get_object()
        note = (request.data.get("note") or "").strip()
        flag.status = RiskFlag.Status.RESOLVED
        flag.resolved_by = request.user
        flag.resolved_at = timezone.now()
        metadata = flag.metadata or {}
        if note:
            metadata["resolution_note"] = note
        flag.metadata = metadata
        flag.save(update_fields=["status", "resolved_by", "resolved_at", "metadata", "updated_at"])
        AuditLog.objects.create(
            actor_user=request.user,
            action="risk_flag_resolved",
            target_table=RiskFlag._meta.label,
            target_id=str(flag.id),
            after={"status": flag.status, "note": note},
        )
        return Response(self.get_serializer(flag).data)


class ApprovalRequestViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ApprovalRequestSerializer
    permission_classes = [permissions.IsAuthenticated, ManagerPermission]
    queryset = ApprovalRequest.objects.select_related("requested_by", "target_user", "reviewed_by").order_by(
        "-created_at"
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        action_type = self.request.query_params.get("action_type")
        if action_type:
            queryset = queryset.filter(action_type=action_type)
        return queryset

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        approval = self.get_object()
        if approval.status != ApprovalRequest.Status.PENDING:
            raise ValidationError({"detail": "Only pending approvals can be approved."})

        comment = (request.data.get("comment") or "").strip()
        approved_payload = dict(approval.payload or {})
        if comment:
            approved_payload["comment"] = comment

        if approval.action_type == ApprovalRequest.ActionType.ASSIGN_ROLE:
            target = approval.target_user
            if not target:
                raise ValidationError({"detail": "Approval target user is missing."})
            requested_role = request.data.get("role") or approved_payload.get("role")
            valid_roles = {choice[0] for choice in User.Roles.choices}
            if requested_role not in valid_roles:
                raise ValidationError({"detail": "Requested role is invalid."})
            previous_role = target.role
            apply_user_role(target, requested_role)
            approved_payload["previous_role"] = previous_role
            approved_payload["applied_role"] = requested_role

            AuditLog.objects.create(
                actor_user=request.user,
                action="role_assigned_via_approval",
                target_table=User._meta.label,
                target_id=str(target.id),
                before={"role": previous_role},
                after={"role": requested_role, "approval_request_id": approval.id},
            )

        approval.status = ApprovalRequest.Status.APPROVED
        approval.reviewed_by = request.user
        approval.reviewed_at = timezone.now()
        approval.comment = comment
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
            action="approval_request_approved",
            target_table=ApprovalRequest._meta.label,
            target_id=str(approval.id),
            after={"status": approval.status, "action_type": approval.action_type},
        )
        return Response(self.get_serializer(approval).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        approval = self.get_object()
        if approval.status != ApprovalRequest.Status.PENDING:
            raise ValidationError({"detail": "Only pending approvals can be rejected."})
        comment = (request.data.get("comment") or "").strip()
        approval.status = ApprovalRequest.Status.REJECTED
        approval.reviewed_by = request.user
        approval.reviewed_at = timezone.now()
        approval.comment = comment
        approval.save(update_fields=["status", "reviewed_by", "reviewed_at", "comment", "updated_at"])
        AuditLog.objects.create(
            actor_user=request.user,
            action="approval_request_rejected",
            target_table=ApprovalRequest._meta.label,
            target_id=str(approval.id),
            after={"status": approval.status, "comment": comment},
        )
        return Response(self.get_serializer(approval).data)
