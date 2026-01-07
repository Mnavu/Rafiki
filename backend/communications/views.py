from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend

from users.models import User, Student
from .models import Thread, Message, CourseChatroom, ChatMessage
from .serializers import ThreadSerializer, MessageSerializer, CourseChatroomSerializer, ChatMessageSerializer
from .serializers import SupportChatSessionSerializer, SupportChatMessageSerializer
from .models import SupportChatSession, SupportChatMessage
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
import re


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
    queryset = ChatMessage.objects.all()
    serializer_class = ChatMessageSerializer

    def perform_create(self, serializer):
        serializer.save(author_user=self.request.user)


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
                Q(parent=user) | Q(student__parent_links__parent=user)
            ).distinct()
        if user.role == User.Roles.STUDENT:
            return base.filter(student=user)
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
            if student and student != user:
                raise PermissionDenied("Students can only open threads for themselves.")
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
                Q(thread__parent=user) | Q(thread__student__parent_links__parent=user)
            ).distinct()
        if user.role == User.Roles.STUDENT:
            return base.filter(thread__student=user)
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
        if user.role == User.Roles.STUDENT and thread.student_id != user.id:
            raise PermissionDenied("Students can only post in their own threads.")
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
        serializer.save(author=user, sender_role=sender_role)

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
