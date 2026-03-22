from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from core.models import TimeStampedModel, Department


class Programme(TimeStampedModel):
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='programmes', null=True, blank=True)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=20, unique=True)
    award_level = models.CharField(max_length=50)
    duration_years = models.IntegerField()
    trimesters_per_year = models.IntegerField()

    def __str__(self):
        return f"{self.name} ({self.code})"

class CurriculumUnit(TimeStampedModel):
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE, related_name="curriculum_units", null=True, blank=True)
    code = models.CharField(max_length=20, unique=True)
    title = models.CharField(max_length=255)
    credit_hours = models.IntegerField()
    trimester_hint = models.IntegerField(null=True, blank=True)
    has_prereq = models.BooleanField(default=False)
    prereq_unit = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.code} - {self.title}"

class TermOffering(TimeStampedModel):
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE, null=True, blank=True)
    unit = models.ForeignKey(CurriculumUnit, on_delete=models.CASCADE, null=True, blank=True)
    academic_year = models.IntegerField()
    trimester = models.IntegerField()
    offered = models.BooleanField(default=False)
    capacity = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ('programme', 'unit', 'academic_year', 'trimester')

    def __str__(self):
        return f"{self.unit.code} ({self.academic_year}/T{self.trimester}) - {'Offered' if self.offered else 'Not Offered'}"

class Registration(TimeStampedModel):
    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        PENDING_HOD = 'pending_hod', 'Pending HOD Approval'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'

    student = models.ForeignKey('users.Student', on_delete=models.CASCADE, related_name='registrations', null=True, blank=True)
    unit = models.ForeignKey(CurriculumUnit, on_delete=models.CASCADE, related_name='registrations', null=True, blank=True)
    academic_year = models.IntegerField()
    trimester = models.IntegerField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_registrations')
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('student', 'unit', 'academic_year', 'trimester')

    def __str__(self):
        return f"{self.student.user.username} registration for {self.unit.code} - {self.status}"

class LecturerAssignment(TimeStampedModel):
    lecturer = models.ForeignKey('users.Lecturer', on_delete=models.CASCADE, related_name='assignments', null=True, blank=True)
    unit = models.ForeignKey(CurriculumUnit, on_delete=models.CASCADE, related_name='lecturer_assignments', null=True, blank=True)
    academic_year = models.IntegerField()
    trimester = models.IntegerField()

    class Meta:
        unique_together = ('lecturer', 'unit', 'academic_year', 'trimester')

    def __str__(self):
        return f"{self.lecturer.user.username} assigned to {self.unit.code} for {self.academic_year}/T{self.trimester}"

class Timetable(TimeStampedModel):
    programme = models.ForeignKey(Programme, on_delete=models.CASCADE, null=True, blank=True)
    unit = models.ForeignKey(CurriculumUnit, on_delete=models.CASCADE, null=True, blank=True)
    lecturer = models.ForeignKey('users.Lecturer', on_delete=models.CASCADE, null=True, blank=True)
    room = models.CharField(max_length=50)
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()

    def __str__(self):
        return f"Timetable: {self.unit.code} in {self.room} at {self.start_datetime}"

class Assignment(TimeStampedModel):
    unit = models.ForeignKey(CurriculumUnit, on_delete=models.CASCADE, related_name="assignments", null=True, blank=True)
    lecturer = models.ForeignKey('users.Lecturer', on_delete=models.CASCADE, related_name="assignments_created", null=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    due_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.title} ({self.unit.code})"

class Submission(TimeStampedModel):
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions', null=True, blank=True)
    student = models.ForeignKey('users.Student', on_delete=models.CASCADE, related_name='submissions', null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    content_url = models.URLField(blank=True, default="")
    text_response = models.TextField(blank=True)
    audio = models.FileField(upload_to="learning/submissions/audio/", blank=True)
    audio_transcript = models.TextField(blank=True)
    grade = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    feedback_text = models.TextField(null=True, blank=True)
    feedback_media_url = models.URLField(null=True, blank=True)

    def __str__(self):
        return f"Submission by {self.student.user.username} for {self.assignment.title}"

from .quiz_models import Quiz, Question, Choice, StudentAnswer
