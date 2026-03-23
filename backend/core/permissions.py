from rest_framework import permissions


def user_has_scope(user, obj) -> bool:
    """
    Shared helper to determine whether a user should see a given object.
    """
    if not user or not getattr(user, "is_authenticated", False) or obj is None:
        return False

    if getattr(user, "is_superuser", False) or getattr(user, "is_staff", False):
        return True

    role = getattr(user, "role", None)
    if not role:
        return False

    owner_user_id = getattr(obj, "owner_user_id", None)
    if owner_user_id and owner_user_id == user.id:
        return True

    direct_user_id = getattr(obj, "user_id", None)
    if direct_user_id and direct_user_id == user.id:
        return True

    student_id = getattr(obj, "student_id", None)
    if not student_id:
        student = getattr(obj, "student", None)
        student_id = getattr(student, "id", None)

    lecturer_id = getattr(obj, "lecturer_id", None)
    if not lecturer_id:
        lecturer = getattr(obj, "lecturer", None)
        lecturer_id = getattr(lecturer, "id", None)

    unit = getattr(obj, "unit", None)
    programme = getattr(obj, "programme", None)
    department_id = getattr(obj, "department_id", None)
    if not department_id and programme:
        department = getattr(programme, "department", None)
        department_id = getattr(department, "id", None)
    if not department_id and unit:
        department = getattr(unit, "department", None)
        if department:
            department_id = getattr(department, "id", None)
        elif hasattr(unit, "course") and unit.course_id:
            department_id = getattr(unit.course, "department_id", None)

    if role == "student" and student_id == user.id:
        return True

    if role == "parent":
        linked_student_ids = set(user.linked_student_ids()) if hasattr(user, "linked_student_ids") else set()
        if student_id and student_id in linked_student_ids:
            return True

    if role == "lecturer":
        if lecturer_id and lecturer_id == user.id:
            return True
        if unit and hasattr(unit, "is_taught_by") and unit.is_taught_by(user):
            return True

    if role == "hod":
        user_department_id = getattr(getattr(user, "department", None), "id", None)
        if user_department_id and department_id == user_department_id:
            return True
        if user_department_id and unit and hasattr(unit, "course"):
            course_department_id = getattr(getattr(unit, "course", None), "department_id", None)
            if course_department_id == user_department_id:
                return True

    if role in {"finance", "records", "admin"}:
        return True

    return False


class IsSelfOrElevated(permissions.BasePermission):
    """
    Basic permission that lets authenticated users list resources, while object access is scoped.
    """

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        return user_has_scope(request.user, obj)


class IsAdminOrLecturer(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.user.is_staff or getattr(request.user, "role", None) == "lecturer"

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        return request.user.is_staff or getattr(obj, "lecturer", None) == request.user


class IsStudentReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return getattr(request.user, "role", None) == "student"
        return False

    def has_object_permission(self, request, view, obj):
        if not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return getattr(request.user, "role", None) == "student"
        return False
