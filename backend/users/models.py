from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import pyotp

# We only import TimeStampedModel here.
# DO NOT import 'Department' or 'Programme' directly to prevent circular errors.
from core.models import TimeStampedModel

class User(AbstractUser):
    class Roles(models.TextChoices):
        STUDENT = "student", "Student"
        PARENT = "parent", "Parent"
        LECTURER = "lecturer", "Lecturer"
        ADMIN = "admin", "Administrator"
        SUPERADMIN = "superadmin", "Super Administrator"
        HOD = "hod", "Head of Department"
        FINANCE = "finance", "Finance"
        RECORDS = "records", "Student Records"
        GUEST = "guest", "Guest" 

    role = models.CharField(max_length=32, choices=Roles.choices, default=Roles.GUEST)
    display_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    must_change_password = models.BooleanField(default=False)
    
    # Accessibility preferences
    prefers_simple_language = models.BooleanField(default=True)
    prefers_high_contrast = models.BooleanField(default=False)
    speech_rate = models.FloatField(default=0.9)
    
    # TOTP fields
    totp_secret = models.CharField(max_length=32, blank=True, default="")
    totp_enabled = models.BooleanField(default=False)
    totp_activated_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.username

    def ensure_totp_secret(self) -> bool:
        if not self.totp_secret:
            self.totp_secret = pyotp.random_base32()
            return True
        return False

    def provisioning_uri(self) -> str:
        if not self.totp_secret:
            return ""
        identifier = self.email or self.username
        totp = pyotp.TOTP(self.totp_secret)
        return totp.provisioning_uri(name=identifier, issuer_name="Rafiki Bot")

    def verify_totp(self, code: str) -> bool:
        if not self.totp_secret or not code:
            return False
        try:
            totp = pyotp.TOTP(self.totp_secret)
            return totp.verify(str(code), valid_window=1)
        except Exception:
            return False

    def reset_totp(self):
        self.totp_secret = ""
        self.totp_enabled = False
        self.totp_activated_at = None


# --- Role-Specific Models ---

class Student(TimeStampedModel):
    class Status(models.TextChoices):
        NEW = 'new', 'New'
        ADMITTED = 'admitted', 'Admitted'
        FINANCE_OK = 'finance_ok', 'Finance OK'
        PENDING_HOD = 'pending_hod', 'Pending HOD Approval'
        ACTIVE = 'active', 'Active'
        BLOCKED = 'blocked', 'Blocked'

    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='student_profile')
    
    # FIX: Use string reference 'learning.Programme' to avoid circular imports
    programme = models.ForeignKey('learning.Programme', on_delete=models.SET_NULL, null=True, blank=True)
    
    year = models.IntegerField()
    trimester = models.IntegerField()
    trimester_label = models.CharField(max_length=50)
    admission_date = models.DateField(default=timezone.now)
    current_status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW)
    stars = models.IntegerField(default=0)

    def __str__(self):
        return self.user.username

class Guardian(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='guardian_profile')

    def __str__(self):
        return self.user.username

class Lecturer(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='lecturer_profile')
    
    # FIX: Use string reference 'core.Department'
    department = models.ForeignKey('core.Department', on_delete=models.SET_NULL, null=True, blank=True)

    @property
    def assigned_load(self):
        return 0

    def __str__(self):
        return self.user.username

class HOD(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='hod_profile')
    
    # FIX: Use string reference 'core.Department'
    department = models.OneToOneField('core.Department', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return self.user.username

class Admin(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='admin_profile')

    def __str__(self):
        return self.user.username

class RecordsOfficer(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='records_officer_profile')

    def __str__(self):
        return self.user.username

class FinanceOfficer(TimeStampedModel):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='finance_officer_profile')

    def __str__(self):
        return self.user.username

class ParentStudentLink(TimeStampedModel):
    parent = models.ForeignKey(
        Guardian,
        on_delete=models.CASCADE,
        related_name="linked_students",
        null=True, blank=True
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name="parent_links",
        null=True, blank=True
    )
    relationship = models.CharField(max_length=50, blank=True)

    class Meta:
        unique_together = ("parent", "student")
        verbose_name = "Parent-student link"
        verbose_name_plural = "Parent-student links"

    def __str__(self):
        rel = f" ({self.relationship})" if self.relationship else ""
        return f"{self.parent.user.username} -> {self.student.user.username}{rel}"


class UserProvisionRequest(TimeStampedModel):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    requested_by = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="provision_requests",
    )
    username = models.CharField(max_length=150)
    display_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    role = models.CharField(max_length=32, choices=User.Roles.choices)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        "users.User",
        null=True,
        blank=True,
        related_name="provision_reviews",
        on_delete=models.SET_NULL,
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_user = models.ForeignKey(
        "users.User",
        null=True,
        blank=True,
        related_name="provision_source_request",
        on_delete=models.SET_NULL,
    )
    temporary_password = models.CharField(max_length=128, blank=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = ("username", "status")

    def __str__(self):
        return f"{self.username} ({self.role}) - {self.status}"


class FamilyEnrollmentIntent(TimeStampedModel):
    student_request = models.OneToOneField(
        UserProvisionRequest,
        related_name="family_intent_student",
        on_delete=models.CASCADE,
        null=True, blank=True
    )
    parent_request = models.OneToOneField(
        UserProvisionRequest,
        related_name="family_intent_parent",
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )
    relationship = models.CharField(max_length=50, blank=True)
    course_codes = models.JSONField(default=list, blank=True)
    student_first_name = models.CharField(max_length=150, blank=True)
    student_last_name = models.CharField(max_length=150, blank=True)
    student_password = models.CharField(max_length=128, blank=True)
    parent_first_name = models.CharField(max_length=150, blank=True)
    parent_last_name = models.CharField(max_length=150, blank=True)
    parent_password = models.CharField(max_length=128, blank=True)
    fee_title = models.CharField(max_length=255, blank=True)
    fee_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    fee_due_date = models.DateField(null=True, blank=True)

    # FIX: Use string reference 'learning.Programme'
    programme = models.ForeignKey('learning.Programme', on_delete=models.SET_NULL, null=True, blank=True)
    
    year = models.IntegerField(null=True, blank=True)
    trimester = models.IntegerField(null=True, blank=True)
    trimester_label = models.CharField(max_length=50, blank=True)
    cohort_year = models.IntegerField(null=True, blank=True)

    def __str__(self):
        parent = self.parent_request.username if self.parent_request else "N/A"
        return f"Family intent: student={self.student_request.username}, parent={parent}"