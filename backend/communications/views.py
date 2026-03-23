from django.db.models import Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import permissions, viewsets
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from uuid import uuid4

from users.models import User, Student
from users.models import ParentStudentLink
from learning.models import Registration, LecturerAssignment, CurriculumUnit
from core.models import CalendarEvent
from notifications.models import Notification
from notifications.delivery import notify_thread_message_received
from .models import Thread, Message, CourseChatroom, ChatMessage
from .serializers import ThreadSerializer, MessageSerializer, CourseChatroomSerializer, ChatMessageSerializer
from .serializers import SupportChatSessionSerializer, SupportChatMessageSerializer
from .models import SupportChatSession, SupportChatMessage
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import re

CLASS_COMMUNITY_REGISTRATION_STATUSES = (
    Registration.Status.SUBMITTED,
    Registration.Status.PENDING_HOD,
    Registration.Status.APPROVED,
)


def get_accessible_unit_ids(user):
    if user.is_staff or user.is_superuser or user.role in [User.Roles.ADMIN, User.Roles.SUPERADMIN]:
        return set(CurriculumUnit.objects.values_list("id", flat=True))
    if user.role == User.Roles.STUDENT and hasattr(user, "student_profile"):
        return set(
            Registration.objects.filter(
                student=user.student_profile,
                status__in=CLASS_COMMUNITY_REGISTRATION_STATUSES,
            ).values_list("unit_id", flat=True)
        )
    if user.role == User.Roles.LECTURER and hasattr(user, "lecturer_profile"):
        return set(
            LecturerAssignment.objects.filter(lecturer=user.lecturer_profile).values_list("unit_id", flat=True)
        )
    if user.role == User.Roles.PARENT and hasattr(user, "guardian_profile"):
        linked_student_ids = ParentStudentLink.objects.filter(
            parent=user.guardian_profile
        ).values_list("student_id", flat=True)
        return set(
            Registration.objects.filter(
                student_id__in=linked_student_ids,
                status__in=CLASS_COMMUNITY_REGISTRATION_STATUSES,
            ).values_list("unit_id", flat=True)
        )
    return set()


class CreateStudentDirectMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        lecturer_id = request.data.get('lecturer_id')
        student_user = request.user

        if not lecturer_id:
            return Response({"error": "lecturer_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        if student_user.role != User.Roles.STUDENT:
            return Response({"error": "Only students can create direct messages"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            lecturer_user = User.objects.get(pk=lecturer_id, role=User.Roles.LECTURER)
        except User.DoesNotExist:
            return Response({"error": "Lecturer not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check if a thread already exists between the lecturer and the student
        thread = Thread.objects.filter(
            teacher=lecturer_user,
            student=student_user
        ).first()

        if not thread:
            thread = Thread.objects.create(
                teacher=lecturer_user,
                student=student_user,
                subject=f"Direct message between {lecturer_user.display_name} and {student_user.display_name}"
            )
        
        serializer = ThreadSerializer(thread)
        return Response(serializer.data, status=status.HTTP_200_OK)



class CourseChatroomViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CourseChatroom.objects.all()
    serializer_class = CourseChatroomSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['unit']


class ChatMessageViewSet(viewsets.ModelViewSet):
    serializer_class = ChatMessageSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['chatroom']

    def _accessible_unit_ids(self, user):
        return get_accessible_unit_ids(user)

    def get_queryset(self):
        user = self.request.user
        unit_ids = self._accessible_unit_ids(user)
        if not unit_ids:
            return ChatMessage.objects.none()
        return ChatMessage.objects.select_related(
            "author_user",
            "chatroom",
            "chatroom__unit",
        ).filter(chatroom__unit_id__in=unit_ids)

    def perform_create(self, serializer):
        user = self.request.user
        chatroom = serializer.validated_data.get("chatroom")
        if not chatroom or not chatroom.unit_id:
            raise PermissionDenied("Valid class chatroom is required.")
        unit_ids = self._accessible_unit_ids(user)
        if chatroom.unit_id not in unit_ids:
            raise PermissionDenied("You can only send messages to your approved class communities.")
        serializer.save(author_user=user)


def redact_pii(text: str) -> str:
    # simple redaction: emails and phone numbers
    if not text:
        return ""
    text = re.sub(r"[\w\.-]+@[\w\.-]+", "[redacted_email]", text)
    text = re.sub(r"\b\d{10,}\b", "[redacted_phone]", text)
    return text



class SupportChatAPIView(APIView):
    """Accept a message from the app, store an anonymized copy, and return a short helper reply."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user = request.user if request.user and request.user.is_authenticated else None
        anon_id = request.data.get("anonymous_id") or ""
        text = request.data.get("text") or ""

        # find or create session
        session, _ = SupportChatSession.objects.get_or_create(user=user, anonymous_id=anon_id)

        redacted = redact_pii(text)
        msg = SupportChatMessage.objects.create(session=session, author_is_user=True, text=text, redacted_text=redacted)

        # Very basic rule-based response
        lower = text.lower()
        if "login" in lower:
            reply = (
                "Check your username and password. If you still can't login try Reset Password. "
                "If using an authenticator make sure your device time is correct."
            )
        elif "student" in lower and "button" in lower:
            reply = "Tap the Student tile on the landing page. If it's not visible contact admin to assign the role."
        elif "reset" in lower or "password" in lower:
            reply = "Request a password reset from the login screen. Use the reset token when prompted. If emails are used check spam folder."
        else:
            reply = "I'm here to help with login and access. Try: 'I can't login', 'Student login button missing', or 'Reset password not working'."

        bot_msg = SupportChatMessage.objects.create(session=session, author_is_user=False, text=reply, redacted_text=redact_pii(reply), response_for=msg)

        return Response({"reply": reply, "session_id": session.id}, status=status.HTTP_201_CREATED)


class ThreadViewSet(viewsets.ModelViewSet):
    serializer_class = ThreadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        base = Thread.objects.all().select_related("student", "teacher", "parent").prefetch_related(
            "messages__author"
        )
        if user.role == User.Roles.PARENT:
            return base.filter(
                Q(parent=user) | Q(student__student_profile__parent_links__parent__user=user)
            ).distinct()
        if user.role == User.Roles.STUDENT:
            return base.filter(Q(student=user) | Q(teacher=user)).distinct()
        if user.role == User.Roles.LECTURER:
            return base.filter(teacher=user)
        if user.is_staff:
            return base
        return base.none()

    def perform_create(self, serializer):
        user = self.request.user
        data = serializer.validated_data
        extra = {}
        if user.role == User.Roles.PARENT:
            extra["parent"] = user
        if user.role == User.Roles.STUDENT:
            student = data.get("student")
            teacher = data.get("teacher")
            if student and student != user:
                raise PermissionDenied("Students can only open threads for themselves.")
            if teacher and teacher.role == User.Roles.STUDENT and teacher == user:
                raise PermissionDenied("Students cannot create peer threads with themselves.")
            if teacher and teacher.role == User.Roles.STUDENT:
                extra["parent"] = None
            extra["student"] = user
        if user.role == User.Roles.LECTURER:
            teacher = data.get("teacher")
            if teacher and teacher != user:
                raise PermissionDenied("Lecturers can only open threads for themselves.")
            extra["teacher"] = user
        serializer.save(**extra)


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        base = Message.objects.select_related(
            "thread",
            "thread__student",
            "thread__teacher",
            "thread__parent",
            "author",
        )
        if user.role == User.Roles.PARENT:
            return base.filter(
                Q(thread__parent=user) | Q(thread__student__student_profile__parent_links__parent__user=user)
            ).distinct()
        if user.role == User.Roles.STUDENT:
            return base.filter(Q(thread__student=user) | Q(thread__teacher=user)).distinct()
        if user.role == User.Roles.LECTURER:
            return base.filter(thread__teacher=user)
        if user.is_staff:
            return base
        return base.none()

    def perform_create(self, serializer):
        user = self.request.user
        thread = serializer.validated_data.get("thread")
        if user.role == User.Roles.PARENT:
            if thread.parent_id is None and thread.student.parent_links.filter(parent=user).exists():
                thread.parent = user
                thread.save(update_fields=["parent"])
            elif thread.parent_id != user.id:
                raise PermissionDenied("Parents can only post in their assigned threads.")
        if user.role == User.Roles.STUDENT and thread.student_id != user.id and thread.teacher_id != user.id:
            raise PermissionDenied("Students can only post in their own or peer threads.")
        if user.role == User.Roles.LECTURER and thread.teacher_id != user.id:
            raise PermissionDenied("Lecturers can only post in their threads.")
        if not (user.is_staff or user.role in [User.Roles.PARENT, User.Roles.STUDENT, User.Roles.LECTURER]):
            raise PermissionDenied("Role not allowed to post messages.")
        role_map = {
            User.Roles.PARENT: Message.SenderRoles.PARENT,
            User.Roles.STUDENT: Message.SenderRoles.STUDENT,
            User.Roles.LECTURER: Message.SenderRoles.TEACHER,
        }
        sender_role = role_map.get(user.role, Message.SenderRoles.TEACHER)
        message = serializer.save(author=user, sender_role=sender_role)
        notify_thread_message_received(message=message)

class CreateDirectMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        student_id = request.data.get('student_id')
        lecturer = request.user

        if not student_id:
            return Response({"error": "student_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        if lecturer.role != User.Roles.LECTURER:
            return Response({"error": "Only lecturers can create direct messages"}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            student_user = User.objects.get(pk=student_id, role=User.Roles.STUDENT)
        except User.DoesNotExist:
            return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check if a thread already exists between the lecturer and the student
        thread = Thread.objects.filter(
            teacher=lecturer,
            student=student_user
        ).first()

        if not thread:
            thread = Thread.objects.create(
                teacher=lecturer,
                student=student_user,
                subject=f"Direct message between {lecturer.display_name} and {student_user.display_name}"
            )
        
        serializer = ThreadSerializer(thread)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CreateLecturerGuardianMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        lecturer = request.user
        if lecturer.role != User.Roles.LECTURER:
            return Response({"error": "Only lecturers can create guardian threads."}, status=status.HTTP_403_FORBIDDEN)

        student_id = request.data.get('student_id')
        guardian_id = request.data.get('guardian_id')
        if not student_id or not guardian_id:
            return Response({"error": "student_id and guardian_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            student_user = User.objects.get(pk=student_id, role=User.Roles.STUDENT)
        except User.DoesNotExist:
            return Response({"error": "Student not found"}, status=status.HTTP_404_NOT_FOUND)
        try:
            guardian_user = User.objects.get(pk=guardian_id, role=User.Roles.PARENT)
        except User.DoesNotExist:
            return Response({"error": "Guardian not found"}, status=status.HTTP_404_NOT_FOUND)

        if not ParentStudentLink.objects.filter(student__user=student_user, parent__user=guardian_user).exists():
            return Response({"error": "Guardian is not linked to this student"}, status=status.HTTP_400_BAD_REQUEST)

        thread = Thread.objects.filter(
            teacher=lecturer,
            student=student_user,
            parent=guardian_user,
        ).first()
        if not thread:
            thread = Thread.objects.create(
                teacher=lecturer,
                student=student_user,
                parent=guardian_user,
                subject=f"Lecturer-Guardian thread for {student_user.display_name or student_user.username}",
            )

        serializer = ThreadSerializer(thread)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CreateStudentPeerMessageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        peer_student_id = request.data.get('peer_student_id')
        student_user = request.user

        if student_user.role != User.Roles.STUDENT:
            return Response({"error": "Only students can create peer channels."}, status=status.HTTP_403_FORBIDDEN)
        if not peer_student_id:
            return Response({"error": "peer_student_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            peer_student_id = int(peer_student_id)
        except (TypeError, ValueError):
            return Response({"error": "peer_student_id must be a valid integer."}, status=status.HTTP_400_BAD_REQUEST)
        if peer_student_id == student_user.id:
            return Response({"error": "You cannot create a peer thread with yourself."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            peer_user = User.objects.get(pk=peer_student_id, role=User.Roles.STUDENT)
        except User.DoesNotExist:
            return Response({"error": "Peer student not found"}, status=status.HTTP_404_NOT_FOUND)

        try:
            student_profile = student_user.student_profile
            peer_profile = peer_user.student_profile
        except Student.DoesNotExist:
            return Response({"error": "Student profile is missing for one of the users."}, status=status.HTTP_400_BAD_REQUEST)

        my_units = Registration.objects.filter(
            student=student_profile,
            status__in=CLASS_COMMUNITY_REGISTRATION_STATUSES,
        ).values_list("unit_id", flat=True)
        shared_units = Registration.objects.filter(
            student=peer_profile,
            status__in=CLASS_COMMUNITY_REGISTRATION_STATUSES,
            unit_id__in=my_units,
        )
        if not shared_units.exists():
            return Response(
                {"error": "Peer messaging is only available for students sharing at least one approved class."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        thread = Thread.objects.filter(
            Q(student=student_user, teacher=peer_user, parent__isnull=True)
            | Q(student=peer_user, teacher=student_user, parent__isnull=True)
        ).first()

        if not thread:
            thread = Thread.objects.create(
                student=student_user,
                teacher=peer_user,
                subject=f"Peer chat between {student_user.display_name or student_user.username} and {peer_user.display_name or peer_user.username}",
            )

        serializer = ThreadSerializer(thread)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ClassCallScheduleView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.role not in [User.Roles.LECTURER, User.Roles.HOD, User.Roles.ADMIN]:
            raise PermissionDenied("Only lecturers, HODs, or admins can schedule class calls.")

        unit_id = request.data.get("unit_id")
        start_at = request.data.get("start_at")
        end_at = request.data.get("end_at")
        title = request.data.get("title") or "Online class call"
        description = request.data.get("description") or ""
        include_guardians = bool(request.data.get("include_guardians", True))
        participant_user_ids = request.data.get("participant_user_ids") or []
        if not unit_id or not start_at or not end_at:
            return Response(
                {"detail": "unit_id, start_at, and end_at are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if participant_user_ids and not isinstance(participant_user_ids, list):
            return Response(
                {"detail": "participant_user_ids must be a list of user IDs."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            unit = CurriculumUnit.objects.select_related("programme", "programme__department").get(pk=unit_id)
        except CurriculumUnit.DoesNotExist:
            return Response({"detail": "Unit not found."}, status=status.HTTP_404_NOT_FOUND)

        if user.role == User.Roles.LECTURER:
            if not hasattr(user, "lecturer_profile"):
                raise PermissionDenied("Lecturer profile missing.")
            assigned = LecturerAssignment.objects.filter(
                lecturer=user.lecturer_profile,
                unit_id=unit.id,
            ).exists()
            if not assigned:
                raise PermissionDenied("You can only schedule calls for your assigned units.")

        if user.role == User.Roles.HOD:
            if not hasattr(user, "hod_profile") or not user.hod_profile.department_id:
                raise PermissionDenied("HOD profile is not linked to a department.")
            if unit.programme_id and unit.programme.department_id != user.hod_profile.department_id:
                raise PermissionDenied("HOD can only schedule class calls for their department.")

        start_dt = parse_datetime(start_at)
        end_dt = parse_datetime(end_at)
        if not start_dt or not end_dt:
            return Response({"detail": "Invalid start_at/end_at datetime format."}, status=status.HTTP_400_BAD_REQUEST)
        if end_dt <= start_dt:
            return Response({"detail": "end_at must be later than start_at."}, status=status.HTTP_400_BAD_REQUEST)

        student_regs = Registration.objects.filter(
            unit_id=unit.id,
            status__in=CLASS_COMMUNITY_REGISTRATION_STATUSES,
        ).select_related("student__user")
        student_user_ids = {row.student.user_id for row in student_regs if row.student_id}
        guardian_user_ids = set()
        if include_guardians and student_user_ids:
            guardian_user_ids = set(
                ParentStudentLink.objects.filter(student_id__in=student_user_ids)
                .values_list("parent__user_id", flat=True)
            )

        lecturer_user_ids = set(
            LecturerAssignment.objects.filter(unit_id=unit.id)
            .values_list("lecturer__user_id", flat=True)
        )
        allowed_user_ids = set(student_user_ids) | guardian_user_ids | lecturer_user_ids | {user.id}
        if participant_user_ids:
            allowed_user_ids |= {
                int(user_id)
                for user_id in participant_user_ids
                if str(user_id).isdigit()
            }

        room_code = f"eduassist-{unit.code.lower()}-{int(timezone.now().timestamp())}"
        meeting_url = f"https://meet.jit.si/{room_code}"
        source_id = str(uuid4())
        created_events = []
        for participant_id in sorted(allowed_user_ids):
            event, _ = CalendarEvent.objects.update_or_create(
                owner_user_id=participant_id,
                source_type="class_call",
                source_id=source_id,
                defaults={
                    "title": title,
                    "description": description,
                    "start_at": start_dt,
                    "end_at": end_dt,
                    "timezone_hint": "Africa/Nairobi",
                    "metadata": {
                        "unit_id": unit.id,
                        "unit_code": unit.code,
                        "unit_title": unit.title,
                        "meeting_url": meeting_url,
                        "scheduled_by_user_id": user.id,
                    },
                    "is_active": True,
                },
            )
            created_events.append(event)
            Notification.objects.create(
                user_id=participant_id,
                type="class_call_scheduled",
                channel=Notification.Channel.IN_APP,
                payload={
                    "source_id": source_id,
                    "title": title,
                    "unit_id": unit.id,
                    "unit_code": unit.code,
                    "meeting_url": meeting_url,
                    "start_at": start_dt.isoformat(),
                    "end_at": end_dt.isoformat(),
                },
                send_at=timezone.now(),
                status=Notification.Status.SENT,
            )

        local_start = timezone.localtime(start_dt).strftime("%b %d, %I:%M %p")
        class_chatroom, _ = CourseChatroom.objects.get_or_create(unit=unit)
        ChatMessage.objects.create(
            chatroom=class_chatroom,
            author_user=user,
            message=(
                f"Class call scheduled: {title} at {local_start}. "
                f"Join with this link: {meeting_url}"
            ),
        )

        return Response(
            {
                "detail": "Class call scheduled successfully.",
                "source_id": source_id,
                "meeting_url": meeting_url,
                "participant_count": len(created_events),
                "unit": {"id": unit.id, "code": unit.code, "title": unit.title},
            },
            status=status.HTTP_201_CREATED,
        )


class ClassCallListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        scope = request.query_params.get("scope", "upcoming")
        events = CalendarEvent.objects.filter(
            owner_user=request.user,
            source_type="class_call",
            is_active=True,
        ).order_by("start_at")
        if scope == "upcoming":
            events = events.filter(end_at__gte=now)
        elif scope == "past":
            events = events.filter(end_at__lt=now)

        payload = [
            {
                "id": event.id,
                "title": event.title,
                "description": event.description,
                "start_at": event.start_at,
                "end_at": event.end_at,
                "source_id": event.source_id,
                "meeting_url": event.metadata.get("meeting_url"),
                "unit_id": event.metadata.get("unit_id"),
                "unit_code": event.metadata.get("unit_code"),
                "unit_title": event.metadata.get("unit_title"),
            }
            for event in events
        ]
        return Response(payload)


class ClassCommunityListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _accessible_unit_ids(self, user):
        return get_accessible_unit_ids(user)

    def get(self, request):
        user = request.user
        unit_ids = self._accessible_unit_ids(user)
        if not unit_ids:
            return Response([])

        units = CurriculumUnit.objects.filter(id__in=unit_ids).select_related("programme").order_by("code")
        now = timezone.now()
        events = CalendarEvent.objects.filter(
            owner_user=user,
            source_type="class_call",
            is_active=True,
            end_at__gte=now,
        ).order_by("start_at")

        first_call_by_unit = {}
        for event in events:
            metadata = event.metadata or {}
            unit_id = metadata.get("unit_id")
            try:
                unit_id_int = int(unit_id)
            except (TypeError, ValueError):
                continue
            if unit_id_int in first_call_by_unit:
                continue
            first_call_by_unit[unit_id_int] = {
                "source_id": event.source_id,
                "meeting_url": metadata.get("meeting_url"),
                "start_at": event.start_at,
                "end_at": event.end_at,
                "title": event.title,
            }

        registrations = (
            Registration.objects.filter(
                unit_id__in=unit_ids,
                status__in=CLASS_COMMUNITY_REGISTRATION_STATUSES,
            )
            .values("unit_id")
            .annotate(total=Count("student", distinct=True))
        )
        students_count_by_unit = {row["unit_id"]: row["total"] for row in registrations}
        lecturers = (
            LecturerAssignment.objects.filter(unit_id__in=unit_ids)
            .values("unit_id")
            .annotate(total=Count("lecturer", distinct=True))
        )
        lecturers_count_by_unit = {row["unit_id"]: row["total"] for row in lecturers}

        payload = []
        for unit in units:
            chatroom, _ = CourseChatroom.objects.get_or_create(unit=unit)
            call = first_call_by_unit.get(unit.id)
            payload.append(
                {
                    "chatroom_id": chatroom.id,
                    "unit_id": unit.id,
                    "unit_code": unit.code,
                    "unit_title": unit.title,
                    "programme_name": unit.programme.name if unit.programme_id else "",
                    "students_count": students_count_by_unit.get(unit.id, 0),
                    "lecturers_count": lecturers_count_by_unit.get(unit.id, 0),
                    "upcoming_call": call,
                }
            )

        return Response(payload)
