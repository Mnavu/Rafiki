from django.contrib import admin
from django.contrib import messages
from django.utils import timezone

from core.models import AuditLog
from users.models import Student, User

from .models import (
    Programme, CurriculumUnit, TermOffering, Registration, 
    LecturerAssignment, Timetable, Assignment, Submission
)
from .quiz_models import Quiz, Question, Choice, StudentAnswer
from .workflows import ensure_registration_channels

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

class ProgrammeYearFilter(admin.SimpleListFilter):
    title = 'academic year'
    parameter_name = 'academic_year'

    def lookups(self, request, model_admin):
        programme_id = request.GET.get('programme__id__exact')
        if programme_id:
            try:
                programme = Programme.objects.get(id=programme_id)
                years = range(1, programme.duration_years + 1)
                return [(year, f'Year {year}') for year in years]
            except Programme.DoesNotExist:
                return []
        
        # Default case: show all unique years from TermOffering
        years = model_admin.get_queryset(request).values_list('academic_year', flat=True).distinct()
        return [(year, f'Year {year}') for year in sorted(years)]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(academic_year=self.value())
        return queryset

@admin.register(TermOffering)
class TermOfferingAdmin(admin.ModelAdmin):
    list_display = ('unit', 'programme', 'academic_year', 'trimester', 'offered')
    list_filter = ('offered', 'programme', ProgrammeYearFilter, 'trimester')
    autocomplete_fields = ('programme', 'unit')

@admin.register(Registration)
class RegistrationAdmin(admin.ModelAdmin):
    actions = ("approve_selected_registrations", "reject_selected_registrations")
    list_display = ('student', 'unit', 'academic_year', 'trimester', 'status', 'approved_by', 'approved_at')
    list_filter = ('status', 'academic_year', 'trimester', 'unit__programme__department')
    search_fields = ('student__user__username', 'unit__code')
    autocomplete_fields = ('student', 'unit', 'approved_by')

    @admin.action(description="Approve selected pending HOD registrations")
    def approve_selected_registrations(self, request, queryset):
        if not request.user.is_staff:
            self.message_user(request, "Only staff can approve registrations.", level=messages.ERROR)
            return

        approved_count = 0
        for registration in queryset.select_related("student__user", "unit__programme"):
            if registration.status != Registration.Status.PENDING_HOD:
                continue
            registration.status = Registration.Status.APPROVED
            registration.approved_by = request.user
            registration.approved_at = timezone.now()
            registration.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
            ensure_registration_channels(registration)
            if registration.student and registration.student.current_status != Student.Status.ACTIVE:
                registration.student.current_status = Student.Status.ACTIVE
                registration.student.save(update_fields=["current_status"])
            AuditLog.objects.create(
                actor_user=request.user,
                action="registration_approved_via_admin",
                target_table=Registration._meta.label,
                target_id=str(registration.id),
                after={
                    "student_username": registration.student.user.username if registration.student_id else "",
                    "unit_code": registration.unit.code if registration.unit_id else "",
                    "status": registration.status,
                },
            )
            approved_count += 1

        if approved_count:
            self.message_user(request, f"Approved {approved_count} registration(s).", level=messages.SUCCESS)
        else:
            self.message_user(
                request,
                "No pending HOD registrations were selected.",
                level=messages.WARNING,
            )

    @admin.action(description="Reject selected pending HOD registrations")
    def reject_selected_registrations(self, request, queryset):
        if not request.user.is_staff:
            self.message_user(request, "Only staff can reject registrations.", level=messages.ERROR)
            return

        rejected_count = 0
        for registration in queryset.select_related("student__user", "unit__programme"):
            if registration.status != Registration.Status.PENDING_HOD:
                continue
            registration.status = Registration.Status.REJECTED
            registration.approved_by = None
            registration.approved_at = None
            registration.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
            if registration.student and registration.student.current_status == Student.Status.PENDING_HOD:
                registration.student.current_status = Student.Status.FINANCE_OK
                registration.student.save(update_fields=["current_status"])
            AuditLog.objects.create(
                actor_user=request.user,
                action="registration_rejected_via_admin",
                target_table=Registration._meta.label,
                target_id=str(registration.id),
                after={
                    "student_username": registration.student.user.username if registration.student_id else "",
                    "unit_code": registration.unit.code if registration.unit_id else "",
                    "status": registration.status,
                },
            )
            rejected_count += 1

        if rejected_count:
            self.message_user(request, f"Rejected {rejected_count} registration(s).", level=messages.SUCCESS)
        else:
            self.message_user(
                request,
                "No pending HOD registrations were selected.",
                level=messages.WARNING,
            )

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
