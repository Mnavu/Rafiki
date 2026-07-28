from django.core.management.base import BaseCommand
from django.db import transaction

from skillapp_core.curriculum.models import Lesson, LessonStep, Milestone, Module

from curriculum_content.seed_data.beadwork_year1 import MODULES as BEADWORK_YEAR1_MODULES

# Add beadwork_year2 (bags/baskets) here once it's authored - the command
# itself never needs to change, only this list.
ALL_MODULE_SETS = [BEADWORK_YEAR1_MODULES]


class Command(BaseCommand):
    help = "Idempotently load the Beadwork Academy curriculum from seed_data/*.py"

    @transaction.atomic
    def handle(self, *args, **options):
        modules_loaded = 0
        lessons_loaded = 0
        steps_loaded = 0
        milestones_loaded = 0

        for module_set in ALL_MODULE_SETS:
            for module_data in module_set:
                unlocks_after_code = module_data.get("unlocks_after")
                unlocks_after = Module.objects.filter(code=unlocks_after_code).first() if unlocks_after_code else None

                module, _ = Module.objects.update_or_create(
                    code=module_data["code"],
                    defaults={
                        "title": module_data["title"],
                        "summary": module_data.get("summary", ""),
                        "order": module_data["order"],
                        "year_index": module_data["year_index"],
                        "unlocks_after": unlocks_after,
                    },
                )
                modules_loaded += 1

                for lesson_data in module_data["lessons"]:
                    lesson, _ = Lesson.objects.update_or_create(
                        code=lesson_data["code"],
                        defaults={
                            "module": module,
                            "title": lesson_data["title"],
                            "order": lesson_data["order"],
                            "instructions_text": lesson_data.get("instructions_text", ""),
                            "intro_video_url": lesson_data.get("intro_video_url", ""),
                            "is_new_technique": lesson_data.get("is_new_technique", False),
                            "estimated_minutes": lesson_data.get("estimated_minutes", 10),
                        },
                    )
                    lessons_loaded += 1

                    for step_data in lesson_data.get("steps", []):
                        LessonStep.objects.update_or_create(
                            lesson=lesson,
                            order=step_data["order"],
                            defaults={
                                "caption": step_data["caption"],
                                "photo_url": step_data.get("photo_url", ""),
                                "is_checklist_item": step_data.get("is_checklist_item", True),
                            },
                        )
                        steps_loaded += 1

                    milestone_data = lesson_data.get("milestone")
                    if milestone_data:
                        Milestone.objects.update_or_create(
                            code=milestone_data["code"],
                            defaults={
                                "lesson": lesson,
                                "module": module,
                                "title": milestone_data["title"],
                                "instructions_for_learner": milestone_data.get("instructions_for_learner", ""),
                                "requires_video": milestone_data.get("requires_video", False),
                            },
                        )
                        milestones_loaded += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Seeded {modules_loaded} modules, {lessons_loaded} lessons, "
                f"{steps_loaded} steps, {milestones_loaded} milestones."
            )
        )
