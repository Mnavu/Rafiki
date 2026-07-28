"""Tiny env-var helper so settings.py doesn't need an extra dependency
just for a few typed os.environ reads."""
import os


def str(key, default=""):  # noqa: A002 - intentionally shadows builtin, mirrors django-environ's API
    return os.environ.get(key, default)


def bool(key, default=False):  # noqa: A002
    value = os.environ.get(key)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def list(key, default=None):  # noqa: A002
    value = os.environ.get(key)
    if value is None:
        return default if default is not None else []
    return [item.strip() for item in value.split(",") if item.strip()]
