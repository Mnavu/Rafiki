from django.conf import settings
from django.core.management.base import BaseCommand

from core.data_bundles import (
    LAUNCH_BUNDLE_NAME,
    calculate_bundle_sha256,
    load_bundle_payload,
    resolve_launch_bundle_path,
    restore_launch_bundle,
)
from core.models import DataBundleImport


class Command(BaseCommand):
    help = "Restore the committed launch bundle into the active database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--bundle-path",
            default=None,
            help="Optional path to the launch bundle JSON file.",
        )
        parser.add_argument(
            "--flush",
            action="store_true",
            help="Flush the target database before loading the bundle.",
        )
        parser.add_argument(
            "--skip-if-disabled",
            action="store_true",
            help="Do nothing unless AUTO_RESTORE_LAUNCH_BUNDLE is enabled.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Restore even if the same bundle SHA was already applied.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be restored without changing the database.",
        )

    def handle(self, *args, **options):
        enabled = bool(getattr(settings, "AUTO_RESTORE_LAUNCH_BUNDLE", False))
        if options["skip_if_disabled"] and not enabled:
            self.stdout.write("AUTO_RESTORE_LAUNCH_BUNDLE is disabled. Skipping launch bundle restore.")
            return

        bundle_path = resolve_launch_bundle_path(options["bundle_path"])
        payload = load_bundle_payload(bundle_path)
        bundle_sha = calculate_bundle_sha256(bundle_path)
        previous_import = DataBundleImport.objects.filter(bundle_name=LAUNCH_BUNDLE_NAME).first()

        if (
            previous_import
            and previous_import.bundle_sha256 == bundle_sha
            and not options["force"]
        ):
            self.stdout.write(
                self.style.SUCCESS(
                    f"Launch bundle {bundle_path} already loaded (sha256={bundle_sha}). No restore needed."
                )
            )
            return

        if options["dry_run"]:
            self.stdout.write(
                self.style.WARNING(
                    f"Dry run only. Would restore {len(payload)} records from {bundle_path} "
                    f"(sha256={bundle_sha}) with flush={options['flush']}."
                )
            )
            return

        restored_path, restored_sha, record_count = restore_launch_bundle(
            str(bundle_path),
            flush=options["flush"],
            verbosity=options.get("verbosity", 1),
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Restored {record_count} records from {restored_path} (sha256={restored_sha})."
            )
        )
