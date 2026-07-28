from django.contrib import admin

from .models import Lesson, LessonStep, Milestone, Module


class LessonStepInline(admin.TabularInline):
    model = LessonStep
    extra = 1
    ordering = ["order"]


class MilestoneInline(admin.TabularInline):
    model = Milestone
    fk_name = "lesson"
    extra = 0


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ["code", "title", "module", "order", "is_new_technique"]
    list_filter = ["module", "is_new_technique"]
    inlines = [LessonStepInline, MilestoneInline]


class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 0
    ordering = ["order"]
    show_change_link = True


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ["code", "title", "year_index", "order", "unlocks_after"]
    list_filter = ["year_index"]
    inlines = [LessonInline]


@admin.register(Milestone)
class MilestoneAdmin(admin.ModelAdmin):
    list_display = ["code", "title", "module", "lesson", "requires_video"]
