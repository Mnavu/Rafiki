from __future__ import annotations

import hashlib
import json
from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import CommandError
from django.core.management.color import no_style
from django.db import connection

LAUNCH_BUNDLE_NAME = "launch_bundle"
LAUNCH_BUNDLE_DUMP_LABELS = (
    "users",
    "learning",
    "finance",
    "communications",
    "repository",
    "chatbot",
    "notifications",
    "rewards",
    "core.department",
    "core.calendarevent",
    "core.datagovernancepolicy",
    "core.rolealertpolicy",
    "core.riskflag",
    "core.approvalrequest",
)
LAUNCH_BUNDLE_SEQUENCE_APPS = (
    "users",
    "learning",
    "finance",
    "communications",
    "repository",
    "chatbot",
    "notifications",
    "rewards",
    "core",
)


def resolve_launch_bundle_path(bundle_path: str | None = None) -> Path:
    configured = bundle_path or getattr(settings, "LAUNCH_BUNDLE_PATH", "")
    if not configured:
        configured = str(Path(settings.BASE_DIR) / "deploy_bundles" / "launch_bundle.json")
    return Path(configured).resolve()


def load_bundle_payload(bundle_path: Path) -> list[dict]:
    if not bundle_path.exists():
        raise CommandError(f"Launch bundle was not found at {bundle_path}")
    return json.loads(bundle_path.read_text(encoding="utf-8"))


def calculate_bundle_sha256(bundle_path: Path) -> str:
    digest = hashlib.sha256()
    with bundle_path.open("rb") as bundle_handle:
        for chunk in iter(lambda: bundle_handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_launch_bundle(bundle_path: str | None = None, *, verbosity: int = 1) -> Path:
    output_path = resolve_launch_bundle_path(bundle_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    call_command(
        "dumpdata",
        *LAUNCH_BUNDLE_DUMP_LABELS,
        output=str(output_path),
        indent=2,
        verbosity=verbosity,
    )
    return output_path


def reset_bundle_sequences() -> None:
    models_to_reset = []
    for app_label in LAUNCH_BUNDLE_SEQUENCE_APPS:
        for model in apps.get_app_config(app_label).get_models():
            if not model._meta.managed or model._meta.proxy:
                continue
            models_to_reset.append(model)

    sql_statements = connection.ops.sequence_reset_sql(no_style(), models_to_reset)
    if not sql_statements:
        return

    with connection.cursor() as cursor:
        for statement in sql_statements:
            cursor.execute(statement)


def restore_launch_bundle(bundle_path: str | None = None, *, flush: bool = False, verbosity: int = 1) -> tuple[Path, str, int]:
    from core.models import DataBundleImport

    resolved_path = resolve_launch_bundle_path(bundle_path)
    payload = load_bundle_payload(resolved_path)
    bundle_sha = calculate_bundle_sha256(resolved_path)

    if flush:
        call_command("flush", interactive=False, verbosity=verbosity)

    call_command("loaddata", str(resolved_path), verbosity=verbosity)
    reset_bundle_sequences()

    DataBundleImport.objects.update_or_create(
        bundle_name=LAUNCH_BUNDLE_NAME,
        defaults={
            "bundle_sha256": bundle_sha,
            "source_path": str(resolved_path),
            "record_count": len(payload),
        },
    )
    return resolved_path, bundle_sha, len(payload)
