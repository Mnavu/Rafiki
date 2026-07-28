"""Helpers for resolving each skill app's concrete mentor/learner link model.

Mirrors Django's own AUTH_USER_MODEL swappable-model pattern: the consuming
project sets `SKILLAPP_MENTOR_LINK_MODEL = "accounts.MentorLearnerLink"` in
settings, and shared code in this package resolves it lazily via the app
registry instead of importing a concrete model directly.
"""
from django.apps import apps
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


def get_mentor_link_model():
    model_label = getattr(settings, "SKILLAPP_MENTOR_LINK_MODEL", None)
    if not model_label:
        raise ImproperlyConfigured(
            "SKILLAPP_MENTOR_LINK_MODEL is not set. Point it at your app's concrete "
            "MentorLearnerLink model, e.g. 'accounts.MentorLearnerLink'."
        )
    return apps.get_model(model_label)


def mentor_can_review_learner(mentor, learner) -> bool:
    Link = get_mentor_link_model()
    return Link.objects.filter(mentor=mentor, learner=learner, can_review=True).exists()


def linked_learner_ids_for_mentor(mentor):
    Link = get_mentor_link_model()
    return Link.objects.filter(mentor=mentor).values_list("learner_id", flat=True)
