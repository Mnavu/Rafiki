from django.contrib import admin
from .models import AuditLog

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('created_at', 'actor_user', 'action', 'target_table', 'target_id')
    list_filter = ('action', 'target_table', 'actor_user')
    search_fields = ('actor_user__username', 'target_table', 'target_id')
    readonly_fields = ('created_at', 'actor_user', 'action', 'target_table', 'target_id', 'before', 'after')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False