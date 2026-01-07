from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from core.models import TimeStampedModel
from users.models import Student
from repository.models import LibraryAsset


class StudentProgress(TimeStampedModel):
    """Overall student progress tracking"""
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='progress_records')
    programme = models.ForeignKey('learning.Programme', on_delete=models.CASCADE, related_name='student_progress')
    term = models.CharField(max_length=20)
    
    # Overall progress
    completion_percentage = models.FloatField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Overall completion percentage"
    )
    activity_score = models.FloatField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        help_text="Engagement and activity score"
    )
    
    # Time tracking
    total_time_spent = models.PositiveIntegerField(default=0, help_text="Total time spent in minutes")
    last_activity_at = models.DateTimeField(null=True)
    consecutive_days = models.PositiveIntegerField(default=0, help_text="Consecutive days of activity")
    
    # Voice feedback
    latest_voice_feedback = models.FileField(upload_to='progress/voice/', blank=True)
    latest_feedback_transcript = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['student', 'programme', 'term']
        ordering = ['-term', 'student__user__username']
        
    def __str__(self):
        return f"{self.student.user.username} - {self.programme.code} ({self.term})"


class ActivityLog(TimeStampedModel):
    """Detailed activity tracking"""
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='activity_logs')
    programme = models.ForeignKey('learning.Programme', on_delete=models.CASCADE, related_name='activity_logs')
    
    # Activity details
    activity_type = models.CharField(max_length=50, choices=[
        ('resource_view', 'Resource View'),
        ('assignment_work', 'Assignment Work'),
        ('voice_practice', 'Voice Practice'),
        ('quiz_attempt', 'Quiz Attempt'),
        ('nanu_interaction', 'Nanu Interaction'),
        ('reward_claim', 'Reward Claim'),
    ])
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    resource = models.ForeignKey(LibraryAsset, null=True, blank=True, 
                               on_delete=models.SET_NULL, related_name='activity_logs')
    details = models.JSONField(null=True, blank=True, help_text="Additional activity details")
    
    # Success tracking
    was_successful = models.BooleanField(null=True, help_text="Whether the activity was completed successfully")
    difficulty_reported = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text="Student-reported difficulty (1-5)"
    )
    needed_help = models.BooleanField(default=False)
    helper_type = models.CharField(max_length=20, blank=True, choices=[
        ('parent', 'Parent'),
        ('teacher', 'Teacher'),
        ('nanu', 'Nanu Assistant'),
        ('peer', 'Classmate'),
    ])
    
    # Voice feedback
    voice_notes = models.FileField(upload_to='activity/voice/', blank=True)
    voice_notes_transcript = models.TextField(blank=True)
    
    class Meta:
        ordering = ['-created_at']
        
    def __str__(self):
        return f"{self.student.user.username} - {self.activity_type} ({self.created_at})"


class CompletionRecord(TimeStampedModel):
    """Track completion of specific course units and resources"""
    student = models.ForeignKey(Student, on_delete=models.CASCADE,
                              related_name='completion_records')
    programme = models.ForeignKey('learning.Programme', on_delete=models.CASCADE, related_name='completion_records')
    unit = models.ForeignKey('learning.CurriculumUnit', on_delete=models.CASCADE, related_name='completion_records')
    resource = models.ForeignKey(LibraryAsset, null=True, blank=True,
                               on_delete=models.SET_NULL, related_name='completion_records')
    assignment = models.ForeignKey('learning.Assignment', null=True, blank=True,
                                 on_delete=models.SET_NULL, related_name='completion_records')
    quiz = models.ForeignKey('learning.Quiz', null=True, blank=True,
                                on_delete=models.SET_NULL, related_name='completion_records')
    
    # Completion details
    completed_at = models.DateTimeField(auto_now_add=True)
    completion_type = models.CharField(max_length=20, choices=[
        ('self_marked', 'Self Marked'),
        ('auto_tracked', 'Automatically Tracked'),
        ('teacher_verified', 'Teacher Verified'),
    ])
    verified_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                  on_delete=models.SET_NULL, related_name='verified_completions')
    
    # Performance metrics
    score = models.FloatField(null=True, blank=True,
                            validators=[MinValueValidator(0), MaxValueValidator(100)])
    time_taken = models.PositiveIntegerField(null=True, blank=True, help_text="Time taken in minutes")
    attempts = models.PositiveIntegerField(default=1)
    
    # Voice feedback
    voice_reflection = models.FileField(upload_to='completion/voice/', blank=True)
    reflection_transcript = models.TextField(blank=True)
    
    class Meta:
        unique_together = ['student', 'programme', 'unit', 'resource', 'assignment', 'quiz']
        ordering = ['-completed_at']
        
    def __str__(self):
        return f"{self.student.user.username} - {self.unit.title}"