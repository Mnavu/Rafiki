from django.core.management.base import BaseCommand

from skillapp_core.rewards.models import Badge

BADGES = [
    {
        "code": "FIRST_MAT",
        "title": "First Mat",
        "description": "Finished your very first beadwork mat!",
        "criteria_hint": "Complete your first mat",
    },
]


class Command(BaseCommand):
    help = "Idempotently load the Beadwork Academy badge catalog."

    def handle(self, *args, **options):
        count = 0
        for badge_data in BADGES:
            Badge.objects.update_or_create(code=badge_data["code"], defaults=badge_data)
            count += 1
        self.stdout.write(self.style.SUCCESS(f"Seeded {count} badges."))
