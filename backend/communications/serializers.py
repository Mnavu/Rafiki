from rest_framework import serializers

from users.models import User
from users.serializers import UserSerializer
from .models import Thread, Message, CourseChatroom, ChatMessage
from .models import SupportChatSession, SupportChatMessage


class CourseChatroomSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseChatroom
        fields = "__all__"


class ChatMessageSerializer(serializers.ModelSerializer):
    author_detail = UserSerializer(source="author_user", read_only=True)

    class Meta:
        model = ChatMessage
        fields = ["id", "chatroom", "author_user", "author_detail", "message", "created_at"]
        read_only_fields = ["id", "author_user", "author_detail", "created_at"]


class MessageSerializer(serializers.ModelSerializer):
    author_detail = UserSerializer(source="author", read_only=True)
    audio = serializers.FileField(required=False, allow_null=True)
    transcript = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Message
        fields = [
            "id",
            "thread",
            "author",
            "author_detail",
            "body",
            "audio",
            "transcript",
            "sender_role",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "author", "author_detail", "created_at", "updated_at", "sender_role"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get("request")
        file_field = data.get("audio")
        audio_field = getattr(instance, "audio", None)
        if file_field and audio_field:
            try:
                exists = audio_field.storage.exists(audio_field.name)
            except Exception:
                exists = False
            if not exists:
                data["audio"] = ""
            elif request:
                data["audio"] = request.build_absolute_uri(instance.audio.url)
        return data

    def validate(self, attrs):
        body = attrs.get("body") or ""
        audio = attrs.get("audio")
        if not body.strip() and not audio and not getattr(self.instance, "pk", None):
            raise serializers.ValidationError("Provide a message body or attach an audio note.")
        return attrs


class ThreadSerializer(serializers.ModelSerializer):
    student = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Roles.STUDENT)
    )
    teacher = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role__in=[User.Roles.LECTURER, User.Roles.STUDENT])
    )
    parent = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Roles.PARENT),
        required=False,
        allow_null=True,
    )
    student_detail = UserSerializer(source="student", read_only=True)
    teacher_detail = UserSerializer(source="teacher", read_only=True)
    parent_detail = UserSerializer(source="parent", read_only=True)
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Thread
        fields = [
            "id",
            "subject",
            "student",
            "teacher",
            "parent",
            "student_detail",
            "teacher_detail",
            "parent_detail",
            "messages",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "messages", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        if not request:
            return attrs
        user = request.user
        student = attrs.get("student") or getattr(self.instance, "student", None)
        teacher = attrs.get("teacher") or getattr(self.instance, "teacher", None)
        parent = attrs.get("parent") or getattr(self.instance, "parent", None)
        if user.role == User.Roles.PARENT:
            if parent and parent != user:
                raise serializers.ValidationError("Parents cannot reassign threads to other parents.")
            if student and not user.linked_students.filter(student=student).exists():
                raise serializers.ValidationError("Parent must be linked to the student to start a thread.")
        if student and teacher and teacher.role == User.Roles.STUDENT:
            if student == teacher:
                raise serializers.ValidationError("Student-to-student threads require two different students.")
            if parent is not None:
                raise serializers.ValidationError("Peer student threads cannot include a guardian participant.")
        return attrs


class SupportChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportChatMessage
        fields = ["id", "session", "author_is_user", "text", "redacted_text", "created_at"]
        read_only_fields = ["id", "redacted_text", "created_at"]


class SupportChatSessionSerializer(serializers.ModelSerializer):
    messages = SupportChatMessageSerializer(many=True, read_only=True)

    class Meta:
        model = SupportChatSession
        fields = ["id", "user", "anonymous_id", "metadata", "messages", "created_at"]
        read_only_fields = ["id", "created_at"]
