from django.conf import settings
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from rest_framework import serializers
# TODO: Refactor to use Programme instead of Course
# from learning.models import Programme
from .display import resolve_user_display_name
from .models import User, ParentStudentLink, UserProvisionRequest, FamilyEnrollmentIntent, Student, Guardian, Lecturer

username_validator = UnicodeUsernameValidator()


class GuardianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guardian
        fields = "__all__"


class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()

    def get_display_name(self, obj):
        return resolve_user_display_name(obj)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "role",
            "must_change_password",
            "prefers_simple_language",
            "prefers_high_contrast",
            "speech_rate",
            "totp_enabled",
        ]
        read_only_fields = ["totp_enabled"]


class SelfProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username", "display_name"]

    def validate_username(self, value):
        normalized = value.strip().lower()
        if not normalized:
            raise serializers.ValidationError("Username is required.")
        try:
            username_validator(normalized)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message)
        qs = User.objects.filter(username__iexact=normalized)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This username is already taken.")
        return normalized

    def validate_display_name(self, value):
        return value.strip()


class AdminUserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = [
            "username",
            "password",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "role",
            "prefers_simple_language",
            "prefers_high_contrast",
            "speech_rate",
        ]

    def validate_username(self, value):
        normalized = value.strip().lower()
        if not normalized:
            raise serializers.ValidationError("Username is required.")
        try:
            username_validator(normalized)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message)
        if User.objects.filter(username__iexact=normalized).exists():
            raise serializers.ValidationError("This username is already taken.")
        return normalized

    def validate_display_name(self, value):
        return value.strip()

    def validate_email(self, value):
        return value.strip().lower()

    def validate_role(self, value):
        allowed = {
            User.Roles.PARENT,
            User.Roles.LECTURER,
            User.Roles.HOD,
            User.Roles.ADMIN,
            User.Roles.SUPERADMIN,
            User.Roles.FINANCE,
            User.Roles.RECORDS,
            User.Roles.GUEST,
        }
        if value not in allowed:
            raise serializers.ValidationError(
                "Use student onboarding for student accounts. This form supports Guardian, staff, and admin roles."
            )
        acting_user = self.context.get("acting_user")
        if (
            value == User.Roles.SUPERADMIN
            and acting_user is not None
            and acting_user.role != User.Roles.SUPERADMIN
            and not acting_user.is_superuser
        ):
            raise serializers.ValidationError("Only super admin users can create superadmin accounts.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data.pop("role")
        user = User(**validated_data)
        if not user.display_name:
            names = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
            user.display_name = names or user.username
        user.set_password(password)
        user.must_change_password = False
        user.save()
        return user


class UserProvisionSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = [
            "username",
            "password",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "role",
            "prefers_simple_language",
            "prefers_high_contrast",
            "speech_rate",
        ]

    def validate_role(self, value):
        allowed = {User.Roles.STUDENT, User.Roles.PARENT}
        if value not in allowed:
            raise serializers.ValidationError("Only student or parent accounts can be provisioned via this endpoint.")
        return value

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        if not user.display_name:
            names = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
            user.display_name = names or user.username
        user.set_password(password)
        user.must_change_password = True
        user.save()
        return user


class GuardianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guardian
        fields = "__all__"


class StudentSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="user_id", read_only=True)
    user = UserSerializer(read_only=True)
    cohort_year = serializers.SerializerMethodField()

    def get_cohort_year(self, obj):
        if getattr(obj, "admission_date", None):
            return obj.admission_date.year
        return None

    class Meta:
        model = Student
        fields = [
            'id',
            'user',
            'programme',
            'year',
            'trimester',
            'trimester_label',
            'cohort_year',
            'current_status',
            'stars'
        ]


class LecturerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lecturer
        fields = "__all__"


class UserProvisionRequestSerializer(serializers.ModelSerializer):
    requested_by_detail = UserSerializer(source="requested_by", read_only=True)
    created_user_detail = UserSerializer(source="created_user", read_only=True)
    records_passcode = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = UserProvisionRequest
        fields = [
            "id",
            "username",
            "display_name",
            "email",
            "role",
            "status",
            "requested_by",
            "requested_by_detail",
            "reviewed_by",
            "reviewed_at",
            "rejection_reason",
            "created_user",
            "created_user_detail",
            "temporary_password",
            "created_at",
            "updated_at",
            "records_passcode",
        ]
        read_only_fields = [
            "status",
            "requested_by",
            "requested_by_detail",
            "reviewed_by",
            "reviewed_at",
            "rejection_reason",
            "created_user",
            "created_user_detail",
            "temporary_password",
            "created_at",
            "updated_at",
        ]

    def validate_role(self, value):
        allowed = {User.Roles.STUDENT, User.Roles.PARENT}
        if value not in allowed:
            raise serializers.ValidationError("Only student or parent roles are supported.")
        return value

    def validate_username(self, value):
        normalized = value.strip().lower()
        try:
            username_validator(normalized)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message)
        if User.objects.filter(username__iexact=normalized).exists():
            raise serializers.ValidationError("This username already exists.")
        if UserProvisionRequest.objects.filter(username__iexact=normalized, status=UserProvisionRequest.Status.PENDING).exists():
            raise serializers.ValidationError("A pending request already exists for this username.")
        return normalized

    def validate_records_passcode(self, value):
        if value != settings.RECORDS_PROVISION_PASSCODE:
            raise serializers.ValidationError("Invalid records approval passcode.")
        return value

    def validate(self, attrs):
        attrs.pop("records_passcode", None)
        return attrs

    def create(self, validated_data):
        requested_by = validated_data.pop("requested_by", None) or self.context.get("requested_by")
        if requested_by is None:
            raise serializers.ValidationError({"detail": "requested_by is required."})
        validated_data["requested_by"] = requested_by
        return super().create(validated_data)


class ParentStudentLinkSerializer(serializers.ModelSerializer):
    parent = serializers.PrimaryKeyRelatedField(
        queryset=Guardian.objects.all()
    )
    student = serializers.PrimaryKeyRelatedField(
        queryset=Student.objects.all()
    )
    parent_detail = UserSerializer(source="parent.user", read_only=True)
    student_detail = UserSerializer(source="student.user", read_only=True)
    records_passcode = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = ParentStudentLink
        fields = [
            "id",
            "parent",
            "student",
            "relationship",
            "records_passcode",
            "created_at",
            "updated_at",
            "parent_detail",
            "student_detail",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "parent_detail", "student_detail"]

    def validate(self, attrs):
        attrs.pop("records_passcode", None)
        return attrs


class FamilyAccountSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True, min_length=6)
    display_name = serializers.CharField(required=False, allow_blank=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)


class FamilyStudentAccountSerializer(FamilyAccountSerializer):
    course_codes = serializers.ListField(
        child=serializers.CharField(), required=False, allow_empty=True
    )
    course_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )


class FamilyFeeSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True, default="Tuition")
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    due_date = serializers.DateField(required=False, allow_null=True)


class FamilyEnrollmentSerializer(serializers.Serializer):
    records_passcode = serializers.CharField(write_only=True)
    student = FamilyStudentAccountSerializer()
    parent = FamilyAccountSerializer()
    relationship = serializers.CharField(required=False, allow_blank=True)
    fee_item = FamilyFeeSerializer(required=False)

    # Academic details
    programme = serializers.IntegerField()
    year = serializers.IntegerField()
    trimester = serializers.IntegerField()
    trimester_label = serializers.CharField()
    cohort_year = serializers.IntegerField()

    def validate(self, attrs):
        passcode = attrs.get("records_passcode")
        if passcode != settings.RECORDS_PROVISION_PASSCODE:
            raise serializers.ValidationError(
                {"records_passcode": "Invalid records approval passcode."}
            )

        student_data = attrs["student"]
        parent_data = attrs["parent"]

        student_username = student_data["username"].strip().lower()
        parent_username = parent_data["username"].strip().lower()

        if student_username == parent_username:
            raise serializers.ValidationError(
                {"parent": "Parent username must differ from student username."}
            )

        try:
            username_validator(student_username)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"student": exc.message})
        if User.objects.filter(username__iexact=student_username).exists():
            raise serializers.ValidationError({"student": "Student username already exists."})
        try:
            username_validator(parent_username)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"parent": exc.message})
        if User.objects.filter(username__iexact=parent_username).exists():
            raise serializers.ValidationError({"parent": "Parent username already exists."})

        student_data["username"] = student_username
        parent_data["username"] = parent_username

        # Normalise course codes
        codes = [code.strip().upper() for code in student_data.get("course_codes", []) if code.strip()]
        student_data["course_codes"] = list(dict.fromkeys(codes))  # deduplicate

        ids = student_data.get("course_ids") or []
        student_data["course_ids"] = list(dict.fromkeys(ids))

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        acting = getattr(request, "user", None)
        if not acting:
            raise serializers.ValidationError({"detail": "Authenticated user required."})

        student_data = validated_data["student"]
        parent_data = validated_data["parent"]
        relationship = validated_data.get("relationship", "").strip()
        fee_input = validated_data.get("fee_item") or {}

        course_ids = student_data.pop("course_ids", [])
        course_codes = student_data.pop("course_codes", [])
        requested_codes = set(course_codes)

        # TODO: Refactor this section to use Programme instead of Course
        # if course_ids:
        #     found_by_id = list(Course.objects.filter(id__in=course_ids))
        #     missing = set(_ids) - {course.id for course in found_by_id}
        #     if missing:
        #         raise serializers.ValidationError(
        #             {"student": f"Course IDs not found: {', '.join(map(str, missing))}"}
        #         )
        #     requested_codes.update(course.code for course in found_by_id)

        # if course_codes:
        #     found_by_code = set(
        #         Course.objects.filter(code__in=course_codes).values_list("code", flat=True)
        #     )
        #     missing_codes = set(course_codes) - found_by_code
        #     if missing_codes:
        #         raise serializers.ValidationError(
        #             {"student": f"Course codes not found: {', '.join(sorted(missing_codes))}"}
        #         )

        student_password = student_data.pop("password")
        parent_password = parent_data.pop("password")

        try:
            with transaction.atomic():
                student_request = UserProvisionRequest.objects.create(
                    requested_by=acting,
                    username=student_data["username"],
                    display_name=student_data.get("display_name", ""),
                    email=student_data.get("email", ""),
                    role=User.Roles.STUDENT,
                )
                parent_request = UserProvisionRequest.objects.create(
                    requested_by=acting,
                    username=parent_data["username"],
                    display_name=parent_data.get("display_name", ""),
                    email=parent_data.get("email", ""),
                    role=User.Roles.PARENT,
                )
                FamilyEnrollmentIntent.objects.create(
                    student_request=student_request,
                    parent_request=parent_request,
                    relationship=relationship,
                    course_codes=list(dict.fromkeys(requested_codes)),
                    student_first_name=student_data.get("first_name", ""),
                    student_last_name=student_data.get("last_name", ""),
                    student_password=student_password,
                    parent_first_name=parent_data.get("first_name", ""),
                    parent_last_name=parent_data.get("last_name", ""),
                    parent_password=parent_password,
                    fee_title=fee_input.get("title", "") or "",
                    fee_amount=fee_input.get("amount"),
                    fee_due_date=fee_input.get("due_date"),
                    programme_id=validated_data.get("programme"),
                    year=validated_data.get("year"),
                    trimester=validated_data.get("trimester"),
                    trimester_label=validated_data.get("trimester_label"),
                    cohort_year=validated_data.get("cohort_year"),
                )
        except IntegrityError:
            raise serializers.ValidationError(
                {"detail": "An approval request already exists for one of the supplied accounts."}
            )

        return {
            'detail': 'Provisioning requests submitted for admin approval.',
            'student_request': UserProvisionRequestSerializer(student_request).data,
            'parent_request': UserProvisionRequestSerializer(parent_request).data,
            'course_codes': list(dict.fromkeys(requested_codes)),
        }
