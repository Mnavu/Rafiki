from django.core.management.base import BaseCommand

from chatbot.models import CourseRevisionKnowledge
from chatbot.revision_bank_seed import REVISION_BANK_ENTRIES, SOURCE_CATALOG
from learning.models import CurriculumUnit


class Command(BaseCommand):
    help = "Seed curated revision-bank entries for tourism and travel units."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show the entries that would be created or updated without saving.",
        )
        parser.add_argument(
            "--unit-code",
            action="append",
            dest="unit_codes",
            help="Only seed one or more unit codes. Repeat the flag to add multiple codes.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        requested_codes = {code.strip().upper() for code in (options.get("unit_codes") or []) if code.strip()}

        created_count = 0
        updated_count = 0
        missing_codes = set()

        self.stdout.write(self.style.MIGRATE_HEADING("Seeding curated revision knowledge bank"))

        for entry in REVISION_BANK_ENTRIES:
            for unit_code in entry["unit_codes"]:
                normalized_code = unit_code.upper()
                if requested_codes and normalized_code not in requested_codes:
                    continue

                unit = (
                    CurriculumUnit.objects.select_related("programme")
                    .filter(code=normalized_code)
                    .first()
                )
                if not unit:
                    missing_codes.add(normalized_code)
                    self.stdout.write(self.style.WARNING(f"Skipped {normalized_code}: unit not found"))
                    continue

                defaults = {
                    "programme": unit.programme,
                    "trigger_phrases": ", ".join(entry["trigger_phrases"]),
                    "explanation": entry["explanation"],
                    "revision_tips": entry["revision_tips"],
                    "practice_prompt": entry["practice_prompt"],
                    "priority": entry["priority"],
                    "is_active": True,
                }
                source_labels = ", ".join(
                    SOURCE_CATALOG[key]["title"]
                    for key in entry.get("source_keys", [])
                    if key in SOURCE_CATALOG
                )

                if dry_run:
                    exists = CourseRevisionKnowledge.objects.filter(
                        unit=unit,
                        topic_title=entry["topic_title"],
                    ).exists()
                    status_label = "UPDATE" if exists else "CREATE"
                    self.stdout.write(
                        f"[DRY RUN] {status_label} {unit.code} :: {entry['topic_title']} :: {source_labels}"
                    )
                    continue

                _, created = CourseRevisionKnowledge.objects.update_or_create(
                    unit=unit,
                    topic_title=entry["topic_title"],
                    defaults=defaults,
                )
                if created:
                    created_count += 1
                    action_style = self.style.SUCCESS
                    action_label = "Created"
                else:
                    updated_count += 1
                    action_style = self.style.HTTP_INFO
                    action_label = "Updated"

                self.stdout.write(
                    action_style(
                        f"{action_label} {unit.code} :: {entry['topic_title']} :: {source_labels}"
                    )
                )

        if dry_run:
            self.stdout.write(self.style.SUCCESS("Dry run complete. No records were written."))
            return

        self.stdout.write(
            self.style.SUCCESS(
                f"Revision bank seeding complete. Created {created_count}, updated {updated_count}."
            )
        )
        if missing_codes:
            missing_list = ", ".join(sorted(missing_codes))
            self.stdout.write(self.style.WARNING(f"Missing unit codes: {missing_list}"))

