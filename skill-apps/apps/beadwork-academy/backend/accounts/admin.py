from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import LearnerProfile, MentorLearnerLink, MentorProfile, User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (
        (
            "Skill app profile",
            {"fields": ("role", "prefers_simple_language", "prefers_high_contrast", "speech_rate")},
        ),
    )
    list_display = ["username", "role", "is_staff"]
    list_filter = ["role", "is_staff"]


@admin.register(LearnerProfile)
class LearnerProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "current_module", "started_at"]


@admin.register(MentorProfile)
class MentorProfileAdmin(admin.ModelAdmin):
    list_display = ["user", "relationship_label"]


@admin.register(MentorLearnerLink)
class MentorLearnerLinkAdmin(admin.ModelAdmin):
    list_display = ["mentor", "learner", "relationship", "can_review"]
