from django.contrib import admin
from .models import (
    Programme, CurriculumUnit, TermOffering, Registration, 
    LecturerAssignment, Timetable, Assignment, Submission
)
from .quiz_models import Quiz, Question, Choice, StudentAnswer

@admin.register(Programme)
class ProgrammeAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'department', 'award_level', 'duration_years')
    search_fields = ('name', 'code')
    list_filter = ('department', 'award_level')

@admin.register(CurriculumUnit)
class CurriculumUnitAdmin(admin.ModelAdmin):
    list_display = ('title', 'code', 'programme', 'credit_hours', 'trimester_hint')
    search_fields = ('title', 'code')
    list_filter = ('programme', 'trimester_hint')
    autocomplete_fields = ('programme', 'prereq_unit')

@admin.register(TermOffering)
class TermOfferingAdmin(admin.ModelAdmin):
    list_display = ('unit', 'programme', 'academic_year', 'trimester', 'offered')
    list_filter = ('offered', 'academic_year', 'trimester', 'programme')
    autocomplete_fields = ('programme', 'unit')

@admin.register(Registration)
class RegistrationAdmin(admin.ModelAdmin):
    list_display = ('student', 'unit', 'academic_year', 'trimester', 'status')
    list_filter = ('status', 'academic_year', 'trimester')
    search_fields = ('student__user__username', 'unit__code')
    autocomplete_fields = ('student', 'unit', 'approved_by')

@admin.register(LecturerAssignment)
class LecturerAssignmentAdmin(admin.ModelAdmin):
    list_display = ('lecturer', 'unit', 'academic_year', 'trimester')
    search_fields = ('lecturer__user__username', 'unit__code')
    autocomplete_fields = ('lecturer', 'unit')

@admin.register(Timetable)
class TimetableAdmin(admin.ModelAdmin):
    list_display = ('unit', 'programme', 'lecturer', 'room', 'start_datetime', 'end_datetime')
    list_filter = ('programme', 'lecturer', 'room')
    search_fields = ('unit__code', 'lecturer__user__username', 'room')
    autocomplete_fields = ('programme', 'unit', 'lecturer')

@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ('title', 'unit', 'lecturer', 'due_at')
    search_fields = ('title', 'unit__code', 'lecturer__user__username')
    autocomplete_fields = ('unit', 'lecturer')

@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('assignment', 'student', 'submitted_at', 'grade')
    list_filter = ('submitted_at', 'grade')
    search_fields = ('assignment__title', 'student__user__username')
    autocomplete_fields = ('assignment', 'student')

@admin.register(Quiz)
class QuizAdmin(admin.ModelAdmin):
    list_display = ('title', 'unit', 'created_at')
    search_fields = ('title', 'unit__code')
    autocomplete_fields = ('unit',)

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('text', 'quiz')
    search_fields = ('text', 'quiz__title')
    autocomplete_fields = ('quiz',)

@admin.register(Choice)
class ChoiceAdmin(admin.ModelAdmin):
    list_display = ('text', 'question', 'is_correct')
    list_filter = ('is_correct',)
    search_fields = ('text', 'question__text')
    autocomplete_fields = ('question',)

@admin.register(StudentAnswer)
class StudentAnswerAdmin(admin.ModelAdmin):
    list_display = ('student', 'question', 'choice', 'get_is_correct')
    list_filter = ('student',)
    search_fields = ('student__user__username', 'question__text')
    autocomplete_fields = ('student', 'question', 'choice')

    @admin.display(boolean=True, description='Is Correct?')
    def get_is_correct(self, obj):
        return obj.choice.is_correct
