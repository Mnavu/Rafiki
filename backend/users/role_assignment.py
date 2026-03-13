from .models import Admin, FinanceOfficer, Guardian, HOD, Lecturer, RecordsOfficer, User


SENSITIVE_ROLES = {
    User.Roles.ADMIN,
    User.Roles.SUPERADMIN,
    User.Roles.RECORDS,
    User.Roles.HOD,
    User.Roles.FINANCE,
}


def apply_user_role(target: User, new_role: str) -> User:
    target.role = new_role
    updates = ["role"]
    should_be_superuser = new_role == User.Roles.SUPERADMIN
    should_be_staff = new_role in {
        User.Roles.SUPERADMIN,
        User.Roles.ADMIN,
        User.Roles.HOD,
        User.Roles.RECORDS,
        User.Roles.FINANCE,
    }

    if target.is_superuser != should_be_superuser:
        target.is_superuser = should_be_superuser
        updates.append("is_superuser")
    if target.is_staff != should_be_staff:
        target.is_staff = should_be_staff
        updates.append("is_staff")

    target.save(update_fields=list(set(updates)))

    if new_role == User.Roles.PARENT:
        Guardian.objects.get_or_create(user=target)
    elif new_role == User.Roles.LECTURER:
        Lecturer.objects.get_or_create(user=target)
    elif new_role == User.Roles.HOD:
        HOD.objects.get_or_create(user=target)
    elif new_role == User.Roles.ADMIN:
        Admin.objects.get_or_create(user=target)
    elif new_role == User.Roles.RECORDS:
        RecordsOfficer.objects.get_or_create(user=target)
    elif new_role == User.Roles.FINANCE:
        FinanceOfficer.objects.get_or_create(user=target)

    return target
