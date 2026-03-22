from django.contrib import admin
from django.utils import timezone

from .models import (
    ChatbotAnswerFeedback,
    Conversation,
    CourseRevisionKnowledge,
    Turn,
)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "title", "updated_at")
    search_fields = ("user__username", "user__display_name", "title")
    list_select_related = ("user",)


@admin.register(Turn)
class TurnAdmin(admin.ModelAdmin):
    list_display = ("id", "conversation", "sender", "created_at")
    list_filter = ("sender",)
    search_fields = ("text", "conversation__user__username", "conversation__user__display_name")
    list_select_related = ("conversation", "conversation__user")


@admin.register(ChatbotAnswerFeedback)
class ChatbotAnswerFeedbackAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "rating",
        "needs_review",
        "visual_cue",
        "navigation_target",
        "reviewed_at",
        "created_at",
    )
    list_filter = ("rating", "needs_review", "visual_cue", "navigation_target", "created_at")
    search_fields = ("user__username", "user__display_name", "query_text", "answer_text", "admin_notes")
    list_select_related = ("user", "reviewed_by", "conversation", "turn")
    actions = ("mark_selected_reviewed",)
    readonly_fields = ("created_at", "updated_at", "query_text", "answer_text")

    @admin.action(description="Mark selected feedback as reviewed")
    def mark_selected_reviewed(self, request, queryset):
        updated = queryset.update(
            needs_review=False,
            reviewed_at=timezone.now(),
            reviewed_by=request.user,
        )
        self.message_user(request, f"{updated} feedback item(s) marked as reviewed.")


@admin.register(CourseRevisionKnowledge)
class CourseRevisionKnowledgeAdmin(admin.ModelAdmin):
    list_display = ("topic_title", "programme", "unit", "priority", "is_active", "updated_at")
    list_filter = ("is_active", "programme")
    search_fields = ("topic_title", "trigger_phrases", "explanation", "revision_tips", "practice_prompt", "unit__code", "unit__title")
    list_select_related = ("programme", "unit")
