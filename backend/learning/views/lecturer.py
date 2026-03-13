from datetime import datetime, time, timedelta
import json

from django.db.models import Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied, ValidationError

from users.models import User
from users.models import ParentStudentLink
from communications.models import Thread
from core.models import CalendarEvent
from notifications.models import Notification
from ..models import Submission, LecturerAssignment, Registration
from ..models import Assignment
from ..progress_models import CompletionRecord
from ..serializers.assignments import SubmissionSerializer


class LecturerGradingViewSet(viewsets.ModelViewSet):
    serializer_class = SubmissionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role != User.Roles.LECTURER:
            return Submission.objects.none()
        
        try:
            lecturer_profile = user.lecturer_profile
            return Submission.objects.filter(assignment__lecturer=lecturer_profile)
        except User.lecturer_profile.RelatedObjectDoesNotExist:
            return Submission.objects.none()

    def partial_update(self, request, pk=None):
        submission = self.get_object()
        user = self.request.user

        try:
            lecturer_profile = user.lecturer_profile
            if submission.assignment.lecturer != lecturer_profile:
                raise PermissionDenied("You can only grade submissions for your own assignments.")
        except User.lecturer_profile.RelatedObjectDoesNotExist:
            raise PermissionDenied("You must be a lecturer to grade submissions.")

        grade = request.data.get('grade')
        if grade is None:
            raise ValidationError("Grade is required.")

        submission.grade = grade
        submission.save()

        # Create or update completion record
        completion_record, created = CompletionRecord.objects.update_or_create(
            student=submission.student,
            programme=submission.student.programme,
            unit=submission.assignment.unit,
            assignment=submission.assignment,
            defaults={
                'score': grade,
                'completion_type': 'teacher_verified',
                'verified_by': user,
            }
        )
        
        # Here you could add logic to check if all assignments for the unit are graded
        # and then mark the unit as complete for the student.

        return Response(self.get_serializer(submission).data)


class LecturerClassesDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != User.Roles.LECTURER:
            raise PermissionDenied("Only lecturers can view this dashboard.")
        try:
            lecturer_profile = user.lecturer_profile
        except User.lecturer_profile.RelatedObjectDoesNotExist:
            raise PermissionDenied("Lecturer profile is missing.")

        assignments = LecturerAssignment.objects.filter(lecturer=lecturer_profile).select_related(
            "unit",
            "unit__programme",
        )
        units = [row.unit for row in assignments]
        unit_ids = [unit.id for unit in units if unit and unit.id]

        now = timezone.now()
        week_start = (now - timedelta(days=now.weekday())).replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )
        response_rows = []
        total_pending_issuance = 0
        total_pending_marking = 0
        total_pending_replies = 0

        threads_by_unit_student = Thread.objects.filter(teacher=user).values_list("student_id", flat=True)
        outstanding_threads = Thread.objects.filter(teacher=user).prefetch_related("messages")
        unresolved = 0
        for thread in outstanding_threads:
            last = thread.messages.order_by("-created_at").first()
            if last and last.author_id != user.id:
                unresolved += 1

        for unit in units:
            if not unit or not unit.id:
                continue
            registered_students = Registration.objects.filter(
                unit=unit,
                status=Registration.Status.APPROVED,
            ).select_related("student__user")
            student_count = registered_students.count()
            student_user_ids = [row.student.user_id for row in registered_students if row.student_id]
            guardians_count = ParentStudentLink.objects.filter(student_id__in=student_user_ids).count()

            course_assignments = Assignment.objects.filter(unit=unit, lecturer=lecturer_profile)
            issued_this_week = course_assignments.filter(created_at__gte=week_start).count()
            pending_to_issue = max(0, 3 - issued_this_week)  # 2 assignments + 1 CAT per week
            pending_to_mark = Submission.objects.filter(
                assignment__in=course_assignments,
                grade__isnull=True,
            ).count()
            pending_messages = sum(1 for student_id in student_user_ids if student_id in threads_by_unit_student)
            total_pending_issuance += pending_to_issue
            total_pending_marking += pending_to_mark
            total_pending_replies += pending_messages

            response_rows.append(
                {
                    "unit_id": unit.id,
                    "unit_code": unit.code,
                    "unit_title": unit.title,
                    "programme_name": unit.programme.name if unit.programme_id else "",
                    "year_hint": registered_students.values_list("student__year", flat=True).distinct().count(),
                    "students": student_count,
                    "guardians": guardians_count,
                    "pending_to_issue": pending_to_issue,
                    "pending_to_mark": pending_to_mark,
                    "pending_messages": pending_messages,
                    "term_progress_percent": min(
                        100,
                        int((course_assignments.count() / 12) * 100),
                    ),
                }
            )

        response_rows.sort(
            key=lambda row: (
                -(row["pending_to_issue"] + row["pending_to_mark"] + row["pending_messages"]),
                row["unit_code"],
            )
        )

        payload = {
            "lecturer": {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name or user.username,
            },
            "totals": {
                "classes": len(response_rows),
                "pending_to_issue": total_pending_issuance,
                "pending_to_mark": total_pending_marking,
                "pending_messages": max(total_pending_replies, unresolved),
            },
            "classes": response_rows,
        }
        return Response(payload)


class LecturerClassDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, unit_id: int):
        user = request.user
        if user.role != User.Roles.LECTURER:
            raise PermissionDenied("Only lecturers can view class detail.")
        try:
            lecturer_profile = user.lecturer_profile
        except User.lecturer_profile.RelatedObjectDoesNotExist:
            raise PermissionDenied("Lecturer profile is missing.")

        assignment_link = LecturerAssignment.objects.filter(
            lecturer=lecturer_profile,
            unit_id=unit_id,
        ).select_related("unit", "unit__programme").first()
        if not assignment_link:
            raise PermissionDenied("You are not assigned to this class.")

        unit = assignment_link.unit
        registrations = Registration.objects.filter(
            unit=unit,
            status=Registration.Status.APPROVED,
        ).select_related("student__user")
        student_user_ids = [row.student.user_id for row in registrations if row.student_id]
        parent_links = ParentStudentLink.objects.filter(
            student_id__in=student_user_ids
        ).select_related("parent__user", "student__user")
        guardians_by_student = {}
        for link in parent_links:
            guardians_by_student.setdefault(link.student_id, []).append(
                {
                    "guardian_user_id": link.parent.user_id,
                    "guardian_name": link.parent.user.display_name or link.parent.user.username,
                    "relationship": link.relationship,
                }
            )

        class_assignments = Assignment.objects.filter(
            unit=unit,
            lecturer=lecturer_profile,
        ).order_by("-due_at", "-created_at")
        assignment_ids = list(class_assignments.values_list("id", flat=True))
        submissions = Submission.objects.filter(
            assignment_id__in=assignment_ids,
            student_id__in=[row.student_id for row in registrations],
        ).values("assignment_id", "student_id", "grade", "submitted_at")
        submission_index = {}
        for row in submissions:
            submission_index[(row["assignment_id"], row["student_id"])] = row

        student_rows = []
        for reg in registrations:
            student_profile = reg.student
            student_user = student_profile.user
            student_assignment_status = []
            done_count = 0
            missed_count = 0
            for assignment in class_assignments:
                submission = submission_index.get((assignment.id, student_profile.user_id))
                status_label = "missed"
                grade_value = None
                if submission:
                    status_label = "submitted"
                    grade_value = submission.get("grade")
                    done_count += 1
                else:
                    due_at = assignment.due_at
                    if due_at and due_at > timezone.now():
                        status_label = "pending"
                    else:
                        missed_count += 1
                student_assignment_status.append(
                    {
                        "assignment_id": assignment.id,
                        "assignment_title": assignment.title,
                        "assessment_type": "cat"
                        if "cat" in assignment.title.lower()
                        else "assignment",
                        "assessment_mode": "physical"
                        if "physical" in assignment.description.lower()
                        else ("oral" if "oral" in assignment.description.lower() else "mixed"),
                        "status": status_label,
                        "grade": grade_value,
                    }
                )
            student_rows.append(
                {
                    "student_user_id": student_user.id,
                    "student_name": student_user.display_name or student_user.username,
                    "year": student_profile.year,
                    "trimester": student_profile.trimester,
                    "guardians": guardians_by_student.get(student_profile.user_id, []),
                    "assessment_summary": {
                        "done": done_count,
                        "missed": missed_count,
                        "total": class_assignments.count(),
                    },
                    "assessments": student_assignment_status,
                }
            )

        pending_to_issue = max(
            0,
            3 - class_assignments.filter(created_at__gte=timezone.now() - timedelta(days=7)).count(),
        )
        pending_to_mark = Submission.objects.filter(
            assignment__in=class_assignments,
            grade__isnull=True,
        ).count()
        unresolved_messages = 0
        class_threads = Thread.objects.filter(
            teacher=user,
            student_id__in=student_user_ids,
        ).prefetch_related("messages")
        for thread in class_threads:
            last = thread.messages.order_by("-created_at").first()
            if last and last.author_id != user.id:
                unresolved_messages += 1

        payload = {
            "class": {
                "unit_id": unit.id,
                "unit_code": unit.code,
                "unit_title": unit.title,
                "programme_name": unit.programme.name if unit.programme_id else "",
            },
            "pending": {
                "notes_or_assessments_to_issue": pending_to_issue,
                "submissions_to_mark": pending_to_mark,
                "messages_waiting_response": unresolved_messages,
            },
            "students": student_rows,
        }
        return Response(payload)


def _week_start_datetime(dt):
    return (dt - timedelta(days=dt.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


def _is_assigned_lecturer(user, unit_id):
    if user.role != User.Roles.LECTURER or not hasattr(user, "lecturer_profile"):
        return False
    return LecturerAssignment.objects.filter(
        lecturer=user.lecturer_profile,
        unit_id=unit_id,
    ).exists()


class LecturerWeeklyPlannerView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != User.Roles.LECTURER:
            raise PermissionDenied("Only lecturers can view weekly plans.")
        unit_id = request.query_params.get("unit_id")
        if not unit_id:
            raise ValidationError({"detail": "unit_id is required."})
        if not _is_assigned_lecturer(user, unit_id):
            raise PermissionDenied("You are not assigned to this unit.")

        assignments = Assignment.objects.filter(
            unit_id=unit_id,
            lecturer=user.lecturer_profile,
        ).order_by("-created_at")
        plans = {}
        for assignment in assignments:
            week_key = "unscoped"
            item_type = "assignment"
            mode = "mixed"
            materials = []
            notes = assignment.description or ""
            if assignment.description.startswith("[PLAN_META]"):
                try:
                    _, payload = assignment.description.split("\n", 1)
                except ValueError:
                    payload = ""
                raw_meta = assignment.description[len("[PLAN_META]") :].split("\n")[0]
                try:
                    meta = json.loads(raw_meta)
                    week_key = meta.get("week_start") or week_key
                    item_type = meta.get("assessment_type") or item_type
                    mode = meta.get("assessment_mode") or mode
                    materials = meta.get("material_links") or []
                    notes = payload
                except Exception:
                    pass
            bucket = plans.setdefault(week_key, {"week_start": week_key, "items": []})
            bucket["items"].append(
                {
                    "assignment_id": assignment.id,
                    "title": assignment.title,
                    "due_at": assignment.due_at,
                    "assessment_type": item_type,
                    "assessment_mode": mode,
                    "material_links": materials,
                    "notes": notes,
                }
            )
        return Response(list(plans.values()))

    def post(self, request):
        user = request.user
        if user.role != User.Roles.LECTURER:
            raise PermissionDenied("Only lecturers can publish weekly plans.")
        unit_id = request.data.get("unit_id")
        week_start = request.data.get("week_start")
        items = request.data.get("items", [])

        if not unit_id or not week_start:
            raise ValidationError({"detail": "unit_id and week_start are required."})
        if not _is_assigned_lecturer(user, unit_id):
            raise PermissionDenied("You are not assigned to this unit.")
        if not isinstance(items, list) or len(items) != 3:
            raise ValidationError({"detail": "Weekly planner requires exactly 3 items (2 assignments + 1 CAT)."})

        type_counts = {"assignment": 0, "cat": 0}
        cleaned = []
        for index, item in enumerate(items):
            if not isinstance(item, dict):
                raise ValidationError({"detail": f"items[{index}] must be an object."})
            item_type = (item.get("assessment_type") or "").strip().lower()
            if item_type not in type_counts:
                raise ValidationError({"detail": f"items[{index}] assessment_type must be 'assignment' or 'cat'."})
            type_counts[item_type] += 1
            title = (item.get("title") or "").strip()
            due_at = item.get("due_at")
            if not title or not due_at:
                raise ValidationError({"detail": f"items[{index}] requires title and due_at."})
            cleaned.append(
                {
                    "title": title,
                    "due_at": due_at,
                    "assessment_type": item_type,
                    "assessment_mode": (item.get("assessment_mode") or "mixed").strip().lower(),
                    "material_links": item.get("material_links") or [],
                    "notes": (item.get("notes") or "").strip(),
                }
            )

        if type_counts["assignment"] != 2 or type_counts["cat"] != 1:
            raise ValidationError({"detail": "Planner guardrail failed: publish exactly 2 assignments and 1 CAT."})

        week_value = parse_date(str(week_start))
        if not week_value:
            raise ValidationError({"detail": "week_start must be a valid date (YYYY-MM-DD)."})
        week_key = week_value.isoformat()

        created_assignments = []
        for payload in cleaned:
            meta = {
                "planner": True,
                "week_start": week_key,
                "assessment_type": payload["assessment_type"],
                "assessment_mode": payload["assessment_mode"],
                "material_links": payload["material_links"],
            }
            description = f"[PLAN_META]{json.dumps(meta)}\n{payload['notes']}"
            assignment = Assignment.objects.create(
                unit_id=unit_id,
                lecturer=user.lecturer_profile,
                title=payload["title"],
                description=description,
                due_at=payload["due_at"],
            )
            created_assignments.append(assignment)

        return Response(
            {
                "detail": "Weekly plan published successfully.",
                "week_start": week_key,
                "created_assignment_ids": [row.id for row in created_assignments],
            },
            status=status.HTTP_201_CREATED,
        )


class LecturerAttendanceSheetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role != User.Roles.LECTURER:
            raise PermissionDenied("Only lecturers can view attendance sheets.")
        unit_id = request.query_params.get("unit_id")
        if not unit_id:
            raise ValidationError({"detail": "unit_id is required."})
        sheets = (
            CalendarEvent.objects.filter(
                owner_user=user,
                source_type="attendance_sheet",
                metadata__unit_id=int(unit_id),
            )
            .order_by("-start_at")[:12]
        )
        payload = [
            {
                "sheet_id": sheet.id,
                "week_start": sheet.metadata.get("week_start"),
                "unit_id": sheet.metadata.get("unit_id"),
                "unit_code": sheet.metadata.get("unit_code"),
                "rows": sheet.metadata.get("rows", []),
                "uploaded_at": sheet.created_at,
            }
            for sheet in sheets
        ]
        return Response(payload)

    def post(self, request):
        user = request.user
        if user.role != User.Roles.LECTURER:
            raise PermissionDenied("Only lecturers can upload attendance sheets.")
        unit_id = request.data.get("unit_id")
        week_start = request.data.get("week_start")
        rows = request.data.get("rows", [])
        if not unit_id or not week_start:
            raise ValidationError({"detail": "unit_id and week_start are required."})
        if not _is_assigned_lecturer(user, unit_id):
            raise PermissionDenied("You are not assigned to this unit.")
        if not isinstance(rows, list):
            raise ValidationError({"detail": "rows must be a list."})
        week_value = parse_date(str(week_start))
        if not week_value:
            raise ValidationError({"detail": "week_start must be a valid date."})

        assignment_link = LecturerAssignment.objects.select_related("unit").filter(
            lecturer=user.lecturer_profile,
            unit_id=unit_id,
        ).first()
        unit = assignment_link.unit
        source_id = f"attendance:{unit_id}:{week_value.isoformat()}:{user.id}"
        event, _ = CalendarEvent.objects.update_or_create(
            owner_user=user,
            source_type="attendance_sheet",
            source_id=source_id,
            defaults={
                "title": f"Attendance - {unit.code}",
                "description": f"Attendance sheet for {unit.title}",
                "start_at": timezone.make_aware(datetime.combine(week_value, time.min)),
                "end_at": timezone.make_aware(datetime.combine(week_value, time.min)),
                "timezone_hint": "Africa/Nairobi",
                "metadata": {
                    "unit_id": unit.id,
                    "unit_code": unit.code,
                    "unit_title": unit.title,
                    "week_start": week_value.isoformat(),
                    "rows": rows,
                },
                "is_active": True,
            },
        )

        # Inform HODs/admins in the lecturer department.
        department_id = assignment_link.unit.programme.department_id if assignment_link.unit.programme_id else None
        if department_id:
            target_users = User.objects.filter(
                Q(role=User.Roles.HOD, hod_profile__department_id=department_id)
                | Q(role=User.Roles.ADMIN)
            ).distinct()
            for target in target_users:
                Notification.objects.create(
                    user=target,
                    type="attendance_uploaded",
                    channel=Notification.Channel.IN_APP,
                    payload={
                        "unit_id": unit.id,
                        "unit_code": unit.code,
                        "week_start": week_value.isoformat(),
                        "uploaded_by": user.id,
                    },
                    send_at=timezone.now(),
                    status=Notification.Status.SENT,
                )

        return Response(
            {
                "detail": "Attendance sheet uploaded.",
                "sheet_id": event.id,
                "unit_id": unit.id,
                "week_start": week_value.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )
