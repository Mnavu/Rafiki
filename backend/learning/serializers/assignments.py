from rest_framework import serializers

from learning.models import Assignment, Registration, Submission


class AssignmentSerializer(serializers.ModelSerializer):
    lecturer_name = serializers.CharField(source="lecturer.display_name", read_only=True)
    unit_title = serializers.CharField(source="unit.title", read_only=True)

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
    student_name = serializers.CharField(source="student.display_name", read_only=True)
    unit_title = serializers.CharField(source="unit.title", read_only=True)

    class Meta:
        model = Registration
        fields = [
            "id",
            "student",
            "student_name",
            "unit",
            "unit_title",
            "status",
            "academic_year",
            "trimester",
            "approved_by",
            "approved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["approved_by", "approved_at", "created_at", "updated_at"]
