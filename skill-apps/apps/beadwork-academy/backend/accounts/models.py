from django.db import models

from skillapp_core.accounts.models import AbstractMentorLearnerLink, AbstractSkillUser


class User(AbstractSkillUser):
    """Concrete user model for Beadwork Academy. All shared fields (role,
    accessibility prefs) come from AbstractSkillUser; nothing beadwork-specific
    lives on User itself so this stays a thin, near-copy-paste starting point
    for a future skill app's own accounts app."""


class LearnerProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name="learner_profile")
    started_at = models.DateTimeField(auto_now_add=True)
    current_module = models.ForeignKey(
        "skillapp_core_curriculum.Module", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"Learner: {self.user.username}"


class MentorProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name="mentor_profile")
    relationship_label = models.CharField(max_length=100, blank=True)

    def __str__(self) -> str:  # pragma: no cover - trivial
        return f"Mentor: {self.user.username}"


class MentorLearnerLink(AbstractMentorLearnerLink):
    """Concrete link table, mirrors Nanu's ParentStudentLink."""
