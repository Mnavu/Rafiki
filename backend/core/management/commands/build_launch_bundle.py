from django.core.management.base import BaseCommand

from core.data_bundles import build_launch_bundle, calculate_bundle_sha256, load_bundle_payload


class Command(BaseCommand):
    help = "Export the local working dataset into a committed launch bundle for redeploys."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            default=None,
            help="Optional path for the launch bundle JSON file.",
        )

    def handle(self, *args, **options):
        output = options["output"]
        bundle_path = build_launch_bundle(output, verbosity=options.get("verbosity", 1))
        payload = load_bundle_payload(bundle_path)
        bundle_sha = calculate_bundle_sha256(bundle_path)
        self.stdout.write(
            self.style.SUCCESS(
                f"Launch bundle written to {bundle_path} with {len(payload)} records (sha256={bundle_sha})."
            )
        )
