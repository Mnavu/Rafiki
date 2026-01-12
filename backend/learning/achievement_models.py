from django.db import models
from django.conf import settings
from core.models import TimeStampedModel

class AchievementCategory(TimeStampedModel):
    """Categories for achievements like Attendance, Learning, Participation"""
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, help_text="Icon identifier for the frontend")
    
    class Meta:
        verbose_name_plural = "Achievement categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Achievement(TimeStampedModel):
    """Specific achievements that can be earned"""
    category = models.ForeignKey(AchievementCategory, on_delete=models.CASCADE, related_name="achievements")
    name = models.CharField(max_length=255)
    description = models.TextField()
    icon = models.CharField(max_length=50, help_text="Icon identifier for the frontend")
    points = models.PositiveIntegerField(default=10)
    max_claims_per_term = models.PositiveIntegerField(default=3, 
        help_text="Maximum times this achievement can be claimed per term")
    requires_approval = models.BooleanField(default=False)
    auto_approve_conditions = models.JSONField(null=True, blank=True, 
        help_text="Conditions for automatic approval in JSON format")
    voice_message = models.TextField(help_text="Encouraging message to speak when achievement is earned")
    
    def __str__(self):
        return self.name


class StudentAchievement(TimeStampedModel):
    """Achievement instances earned by students"""
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, 
        related_name="achievements", limit_choices_to={"role": "student"})
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name="student_achievements")
    points_earned = models.PositiveIntegerField()
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, 
        null=True, related_name="approved_achievements")
    approved_at = models.DateTimeField(null=True, blank=True)
    term = models.CharField(max_length=20, help_text="Academic term when earned")
    evidence = models.JSONField(null=True, blank=True, 
        help_text="Supporting data for the achievement claim")
    voice_feedback = models.TextField(blank=True, help_text="Custom voice message for this achievement instance")
    
    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.student.username} - {self.achievement.name}"


class RewardClaim(TimeStampedModel):
    """Records of rewards claimed using achievement points"""
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, 
        related_name="reward_claims", limit_choices_to={"role": "student"})
    points_spent = models.PositiveIntegerField()
    reward_description = models.TextField()
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, 
        null=True, related_name="approved_rewards")
    approved_at = models.DateTimeField(null=True, blank=True)
    term = models.CharField(max_length=20)
    voice_confirmation = models.TextField(blank=True, help_text="Custom voice message when reward is claimed")
    
    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(points_spent__gt=0),  # <--- UPDATED: Used 'condition' instead of 'check'
                name="points_spent_positive"
            )
        ]

    def __str__(self):
        return f"{self.student.username} - {self.points_spent} points"


class TermProgress(TimeStampedModel):
    """Tracks student's achievement progress per term"""
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name="term_progress", limit_choices_to={"role": "student"})
    term = models.CharField(max_length=20)
    total_points_earned = models.PositiveIntegerField(default=0)
    total_points_spent = models.PositiveIntegerField(default=0)
    rewards_claimed_count = models.PositiveIntegerField(default=0)
    
    class Meta:
        unique_together = ["student", "term"]
        ordering = ["-term"]

    @property
    def available_points(self):
        return max(0, self.total_points_earned - self.total_points_spent)

    def __str__(self):
        return f"{self.student.username} - {self.term}"