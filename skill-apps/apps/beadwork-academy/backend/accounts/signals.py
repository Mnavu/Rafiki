from django.db.models.signals import post_save
from django.dispatch import receiver

from skillapp_core.accounts.models import Roles

from .models import LearnerProfile, MentorProfile, User


@receiver(post_save, sender=User)
def ensure_role_profile(sender, instance: User, created, **kwargs):
    """Mirrors Nanu's role_assignment.apply_user_role: lazily creates the
    matching profile row whenever a user is created or their role changes."""
    if instance.role == Roles.LEARNER:
        LearnerProfile.objects.get_or_create(user=instance)
    elif instance.role == Roles.MENTOR:
        MentorProfile.objects.get_or_create(user=instance)
