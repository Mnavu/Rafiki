from .models import User


def _is_placeholder_display_name(value: str) -> bool:
    normalized = value.strip().lower()
    if not normalized:
        return False
    return normalized.startswith("demo student") or normalized.startswith("demo guardian")


def _is_placeholder_username(value: str) -> bool:
    normalized = value.strip().lower()
    if not normalized:
        return False
    return normalized.startswith("demo_student") or normalized.startswith("demo_guardian")


def resolve_user_display_name(user: User | None) -> str:
    if not user:
        return ""
    display = (user.display_name or "").strip()
    names = f"{(user.first_name or '').strip()} {(user.last_name or '').strip()}".strip()
    username = (user.username or "").strip()

    if display and not _is_placeholder_display_name(display):
        return display
    if names:
        return names
    if username and not _is_placeholder_username(username):
        return username
    if display:
        return display
    return username
