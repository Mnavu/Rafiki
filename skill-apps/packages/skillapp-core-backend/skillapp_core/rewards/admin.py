from django.contrib import admin

from .models import Award, Badge


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display = ["code", "title"]


@admin.register(Award)
class AwardAdmin(admin.ModelAdmin):
    list_display = ["learner", "points", "badge", "reason", "created_at"]
    list_filter = ["badge"]
