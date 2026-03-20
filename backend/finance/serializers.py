from rest_framework import serializers

from users.display import resolve_user_display_name

from .models import FeeStructure, Payment, FinanceThreshold, FinanceStatus


class FeeStructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeStructure
        fields = "__all__"


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_username = serializers.SerializerMethodField()

    def get_student_name(self, obj):
        if not obj.student_id or not getattr(obj.student, "user", None):
            return ""
        return resolve_user_display_name(obj.student.user)

    def get_student_username(self, obj):
        if not obj.student_id or not getattr(obj.student, "user", None):
            return ""
        return obj.student.user.username

    class Meta:
        model = Payment
        fields = [
            "id",
            "student",
            "student_name",
            "student_username",
            "academic_year",
            "trimester",
            "amount",
            "method",
            "ref",
            "paid_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["paid_at", "created_at", "updated_at"]


class PaymentCreateSerializer(serializers.ModelSerializer):
    student = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = Payment
        fields = ["student", "academic_year", "trimester", "amount", "method", "ref"]




class FinanceThresholdSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinanceThreshold
        fields = "__all__"


class FinanceStatusSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    student_username = serializers.SerializerMethodField()
    student_status = serializers.CharField(source="student.current_status", read_only=True)
    programme_name = serializers.CharField(source="student.programme.name", read_only=True)
    study_year = serializers.IntegerField(source="student.year", read_only=True)
    trimester_label = serializers.CharField(source="student.trimester_label", read_only=True)

    def get_student_name(self, obj):
        if not obj.student_id or not getattr(obj.student, "user", None):
            return ""
        return resolve_user_display_name(obj.student.user)

    def get_student_username(self, obj):
        if not obj.student_id or not getattr(obj.student, "user", None):
            return ""
        return obj.student.user.username

    class Meta:
        model = FinanceStatus
        fields = [
            "id",
            "student",
            "student_name",
            "student_username",
            "student_status",
            "programme_name",
            "study_year",
            "trimester_label",
            "academic_year",
            "trimester",
            "total_due",
            "total_paid",
            "status",
            "clearance_status",
            "created_at",
            "updated_at",
        ]
