from rest_framework import serializers

from learning.models import Assignment, Registration, Submission
from users.display import resolve_user_display_name


class AssignmentSerializer(serializers.ModelSerializer):
    lecturer_name = serializers.SerializerMethodField()
    unit_title = serializers.CharField(source="unit.title", read_only=True)

    def get_lecturer_name(self, obj):
        lecturer_user = getattr(getattr(obj, "lecturer", None), "user", None)
        return resolve_user_display_name(lecturer_user)

    class Meta:
        model = Assignment
        fields = [
            "id",
            "unit",
            "unit_title",
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
    class Meta:
        model = Submission
        fields = "__all__"


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
