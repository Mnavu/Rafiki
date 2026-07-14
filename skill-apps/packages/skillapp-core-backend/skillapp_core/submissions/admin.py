from django.contrib import admin

from .models import MilestoneSubmission


@admin.register(MilestoneSubmission)
class MilestoneSubmissionAdmin(admin.ModelAdmin):
    list_display = ["learner", "milestone", "status", "last_submitted_at", "reviewed_by"]
    list_filter = ["status"]
    readonly_fields = ["first_submitted_at", "last_submitted_at"]
