from rest_framework import serializers

from learning.models import Assignment, Registration, Submission
from users.display import resolve_user_display_name


class AssignmentSerializer(serializers.ModelSerializer):
    lecturer_name = serializers.SerializerMethodField()
    unit_title = serializers.CharField(source="unit.title", read_only=True)
    unit_code = serializers.CharField(source="unit.code", read_only=True)

    def get_lecturer_name(self, obj):
        lecturer_user = getattr(getattr(obj, "lecturer", None), "user", None)
        return resolve_user_display_name(lecturer_user)

    class Meta:
        model = Assignment
        fields = [
            "id",
            "unit",
            "unit_title",
            "unit_code",
            "lecturer",
            "lecturer_name",
            "title",
            "description",
            "due_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]


class SubmissionSerializer(serializers.ModelSerializer):
    assignment_title = serializers.CharField(source="assignment.title", read_only=True)
    assignment_due_at = serializers.DateTimeField(source="assignment.due_at", read_only=True)
    unit_id = serializers.IntegerField(source="assignment.unit_id", read_only=True)
    department_id = serializers.IntegerField(source="assignment.unit.programme.department_id", read_only=True)
    unit_title = serializers.CharField(source="assignment.unit.title", read_only=True)
    unit_code = serializers.CharField(source="assignment.unit.code", read_only=True)
    student_name = serializers.SerializerMethodField()
    student_username = serializers.SerializerMethodField()
    audio_url = serializers.SerializerMethodField()

    def get_student_name(self, obj):
        student_user = getattr(getattr(obj, "student", None), "user", None)
        return resolve_user_display_name(student_user)

    def get_student_username(self, obj):
        student_user = getattr(getattr(obj, "student", None), "user", None)
        if not student_user:
            return ""
        return student_user.username

    def get_audio_url(self, obj):
        audio = getattr(obj, "audio", None)
        if not audio:
            return ""
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(audio.url)
        return audio.url

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        content_url = attrs.get("content_url", getattr(instance, "content_url", ""))
        text_response = attrs.get("text_response", getattr(instance, "text_response", ""))
        audio = attrs.get("audio", getattr(instance, "audio", None))
        audio_transcript = attrs.get("audio_transcript", getattr(instance, "audio_transcript", ""))

        if not str(content_url or "").strip() and not str(text_response or "").strip() and not audio and not str(audio_transcript or "").strip():
            raise serializers.ValidationError(
                "Provide a document link, written answer, or voice submission."
            )
        return attrs

    class Meta:
        model = Submission
        fields = [
            "id",
            "assignment",
            "assignment_title",
            "assignment_due_at",
            "unit_id",
            "department_id",
            "unit_title",
            "unit_code",
            "student",
            "student_name",
            "student_username",
            "submitted_at",
            "content_url",
            "text_response",
            "audio",
            "audio_url",
            "audio_transcript",
            "grade",
            "feedback_text",
            "feedback_media_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["student", "submitted_at", "created_at", "updated_at"]


class RegistrationSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_username = serializers.SerializerMethodField()
    unit_title = serializers.CharField(source="unit.title", read_only=True)
    unit_code = serializers.CharField(source="unit.code", read_only=True)
    programme_id = serializers.IntegerField(source="unit.programme_id", read_only=True)
    programme_name = serializers.CharField(source="unit.programme.name", read_only=True)
    department_id = serializers.IntegerField(source="unit.programme.department_id", read_only=True)

    def get_student_name(self, obj):
        if not obj.student_id or not getattr(obj.student, "user", None):
            return ""
        return resolve_user_display_name(obj.student.user)

    def get_student_username(self, obj):
        if not obj.student_id or not getattr(obj.student, "user", None):
            return ""
        return obj.student.user.username

    class Meta:
        model = Registration
        fields = [
            "id",
            "student",
            "student_name",
            "student_username",
            "unit",
            "unit_code",
            "unit_title",
            "programme_id",
            "programme_name",
            "department_id",
            "status",
            "academic_year",
            "trimester",
            "approved_by",
            "approved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["approved_by", "approved_at", "created_at", "updated_at"]
