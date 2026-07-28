from rest_framework.permissions import BasePermission

from skillapp_core.accounts.utils import mentor_can_review_learner


class IsLinkedMentor(BasePermission):
    """Only a mentor with an active, review-capable link to the submission's
    learner may act on it (approve / request changes / view in their inbox).
    """

    def has_object_permission(self, request, view, obj) -> bool:
        if not getattr(request.user, "is_mentor", False):
            return False
        return mentor_can_review_learner(request.user, obj.learner)
