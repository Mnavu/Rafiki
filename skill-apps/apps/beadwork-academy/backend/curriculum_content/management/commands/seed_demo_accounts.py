"""Creates one demo learner + one demo mentor account, linked together, so a
fresh checkout can be exercised end to end without manually clicking through
Django admin every time. Idempotent - safe to rerun."""
from django.core.management.base import BaseCommand

from accounts.models import MentorLearnerLink, User
from skillapp_core.accounts.models import Relationship, Roles


class Command(BaseCommand):
    help = "Seed one demo learner + one demo mentor account, linked together."

    def handle(self, *args, **options):
        learner, created = User.objects.get_or_create(
            username="learner1", defaults={"role": Roles.LEARNER}
        )
        if created:
            learner.set_password("Learner@2025")
            learner.save()

        mentor, created = User.objects.get_or_create(
            username="mentor1", defaults={"role": Roles.MENTOR}
        )
        if created:
            mentor.set_password("Mentor@2025")
            mentor.save()

        MentorLearnerLink.objects.get_or_create(
            mentor=mentor, learner=learner, defaults={"relationship": Relationship.PARENT, "can_review": True}
        )

        self.stdout.write(
            self.style.SUCCESS(
                "Seeded demo accounts: learner1 / Learner@2025, mentor1 / Mentor@2025 (linked)."
            )
        )
