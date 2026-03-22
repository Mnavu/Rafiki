from django.contrib import admin, messages
from django.http import HttpResponseRedirect
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html

from .models import (
    ChatbotAnswerFeedback,
    Conversation,
    CourseRevisionKnowledge,
    Turn,
)


class NotUsefulFeedbackFilter(admin.SimpleListFilter):
    title = "feedback queue"
    parameter_name = "feedback_queue"

    def lookups(self, request, model_admin):
        return (("not_useful", "Not useful only"),)

    def queryset(self, request, queryset):
        if self.value() == "not_useful":
            return queryset.filter(rating=ChatbotAnswerFeedback.Rating.NOT_HELPFUL)
        return queryset


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
        "query_preview",
        "answer_preview",
        "visual_cue",
        "navigation_target",
        "reviewed_by",
        "reviewed_at",
        "created_at",
    )
    list_filter = (NotUsefulFeedbackFilter, "rating", "needs_review", "visual_cue", "navigation_target", "created_at")
    search_fields = ("user__username", "user__display_name", "query_text", "answer_text", "admin_notes")
    list_select_related = ("user", "reviewed_by", "conversation", "turn")
    date_hierarchy = "created_at"
    actions = ("mark_selected_reviewed",)
    readonly_fields = (
        "user",
        "conversation",
        "turn",
        "rating",
        "query_text",
        "answer_text",
        "visual_cue",
        "navigation_target",
        "mark_reviewed_button",
        "created_at",
        "updated_at",
    )
    fields = (
        "user",
        "conversation",
        "turn",
        "rating",
        "needs_review",
        "visual_cue",
        "navigation_target",
        "query_text",
        "answer_text",
        "admin_notes",
        "mark_reviewed_button",
        "reviewed_by",
        "reviewed_at",
        "created_at",
        "updated_at",
    )

    def get_urls(self):
        urls = super().get_urls()
        custom_urls = [
            path(
                "<path:object_id>/mark-reviewed/",
                self.admin_site.admin_view(self.mark_reviewed_view),
                name="chatbot_chatbotanswerfeedback_mark_reviewed",
            ),
        ]
        return custom_urls + urls

    @admin.action(description="Mark selected feedback as reviewed")
    def mark_selected_reviewed(self, request, queryset):
        updated = queryset.update(
            needs_review=False,
            reviewed_at=timezone.now(),
            reviewed_by=request.user,
        )
        self.message_user(request, f"{updated} feedback item(s) marked as reviewed.")

    def mark_reviewed_view(self, request, object_id):
        feedback = self.get_object(request, object_id)
        if feedback is None:
            self.message_user(request, "Feedback item not found.", level=messages.ERROR)
            return HttpResponseRedirect(reverse("admin:chatbot_chatbotanswerfeedback_changelist"))
        if not self.has_change_permission(request, feedback):
            self.message_user(request, "You do not have permission to review feedback.", level=messages.ERROR)
            return HttpResponseRedirect(
                reverse("admin:chatbot_chatbotanswerfeedback_change", args=[feedback.pk])
            )

        feedback.needs_review = False
        feedback.reviewed_at = timezone.now()
        feedback.reviewed_by = request.user
        feedback.save(update_fields=["needs_review", "reviewed_at", "reviewed_by", "updated_at"])
        self.message_user(request, "Feedback marked as reviewed.", level=messages.SUCCESS)
        return HttpResponseRedirect(reverse("admin:chatbot_chatbotanswerfeedback_change", args=[feedback.pk]))

    @admin.display(description="Question")
    def query_preview(self, obj):
        text = (obj.query_text or "").strip()
        return text[:80] + ("..." if len(text) > 80 else "")

    @admin.display(description="Answer")
    def answer_preview(self, obj):
        text = (obj.answer_text or "").strip()
        return text[:100] + ("..." if len(text) > 100 else "")

    @admin.display(description="Review action")
    def mark_reviewed_button(self, obj):
        if not obj.pk:
            return "Save the feedback item first."
        if not obj.needs_review:
            return "Already reviewed."
        review_url = reverse("admin:chatbot_chatbotanswerfeedback_mark_reviewed", args=[obj.pk])
        return format_html(
            '<a class="button" href="{}" style="padding: 8px 12px;">Mark reviewed</a>',
            review_url,
        )


@admin.register(CourseRevisionKnowledge)
class CourseRevisionKnowledgeAdmin(admin.ModelAdmin):
    list_display = ("topic_title", "programme", "unit", "priority", "is_active", "updated_at")
    list_filter = ("is_active", "programme")
    search_fields = ("topic_title", "trigger_phrases", "explanation", "revision_tips", "practice_prompt", "unit__code", "unit__title")
    list_select_related = ("programme", "unit")
