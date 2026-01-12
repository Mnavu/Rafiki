from django.contrib import admin
from .models import (
    CourseChatroom, ChatMessage, Thread, Message,
    SupportChatSession, SupportChatMessage
)

@admin.register(CourseChatroom)
class CourseChatroomAdmin(admin.ModelAdmin):
    list_display = ('unit',)
    search_fields = ('unit__code', 'unit__title')
    autocomplete_fields = ('unit',)

@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('chatroom', 'author_user', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('author_user__username', 'message')
    autocomplete_fields = ('chatroom', 'author_user')

@admin.register(Thread)
class ThreadAdmin(admin.ModelAdmin):
    list_display = ('subject', 'student', 'teacher', 'parent', 'created_at')
    search_fields = ('subject', 'student__username', 'teacher__username', 'parent__username')
    autocomplete_fields = ('student', 'teacher', 'parent')

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('thread', 'author', 'sender_role', 'created_at')
    list_filter = ('sender_role', 'created_at')
    search_fields = ('author__username', 'body', 'transcript')
    autocomplete_fields = ('thread', 'author')

@admin.register(SupportChatSession)
class SupportChatSessionAdmin(admin.ModelAdmin):
    list_display = ('user', 'anonymous_id', 'created_at')
    search_fields = ('user__username', 'anonymous_id')
    autocomplete_fields = ('user',)

@admin.register(SupportChatMessage)
class SupportChatMessageAdmin(admin.ModelAdmin):
    list_display = ('session', 'author_is_user', 'created_at')
    list_filter = ('author_is_user', 'created_at')
    search_fields = ('session__user__username', 'text')
    autocomplete_fields = ('session', 'response_for')
