from django.contrib import admin
from .models import Merit

@admin.register(Merit)
class MeritAdmin(admin.ModelAdmin):
    list_display = ('student', 'stars', 'awarded_by', 'created_at', 'reason')
    list_filter = ('created_at', 'student', 'awarded_by')
    search_fields = ('student__user__username', 'reason', 'awarded_by__username')
    autocomplete_fields = ('student', 'awarded_by')