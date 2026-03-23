from pathlib import Path
import shutil

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Restore committed demo media files into MEDIA_ROOT."

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            default=None,
            help="Optional override for the bundled media source directory.",
        )
        parser.add_argument(
            "--skip-if-disabled",
            action="store_true",
            help="Do nothing unless AUTO_RESTORE_BUNDLED_MEDIA is enabled.",
        )

    def handle(self, *args, **options):
        enabled = bool(getattr(settings, "AUTO_RESTORE_BUNDLED_MEDIA", False))
        if options["skip_if_disabled"] and not enabled:
            self.stdout.write("AUTO_RESTORE_BUNDLED_MEDIA is disabled. Skipping bundled media restore.")
            return

        source_root = Path(options["source"] or (settings.BASE_DIR / "deploy_media")).resolve()
        target_root = Path(settings.MEDIA_ROOT).resolve()

        if not source_root.exists():
            self.stdout.write(f"No bundled media directory found at {source_root}. Nothing to restore.")
            return

        copied = 0
        for source_path in source_root.rglob("*"):
            if not source_path.is_file():
                continue
            relative_path = source_path.relative_to(source_root)
            target_path = target_root / relative_path
            target_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_path, target_path)
            copied += 1

        self.stdout.write(self.style.SUCCESS(f"Restored {copied} bundled media files into {target_root}."))
