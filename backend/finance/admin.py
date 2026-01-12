from django.contrib import admin
from .models import FeeStructure, Payment, FinanceThreshold, FinanceStatus

@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = ('programme', 'academic_year', 'trimester')
    list_filter = ('academic_year', 'trimester', 'programme')
    search_fields = ('programme__code',)
    autocomplete_fields = ('programme',)

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('student', 'amount', 'academic_year', 'trimester', 'paid_at', 'method')
    list_filter = ('academic_year', 'trimester', 'method', 'paid_at')
    search_fields = ('student__user__username', 'ref')
    autocomplete_fields = ('student',)

@admin.register(FinanceThreshold)
class FinanceThresholdAdmin(admin.ModelAdmin):
    list_display = ('programme', 'academic_year', 'trimester', 'threshold_amount')
    list_filter = ('academic_year', 'trimester', 'programme')
    search_fields = ('programme__code',)
    autocomplete_fields = ('programme',)

@admin.register(FinanceStatus)
class FinanceStatusAdmin(admin.ModelAdmin):
    list_display = ('student', 'academic_year', 'trimester', 'total_due', 'total_paid', 'balance', 'status', 'clearance_status')
    list_filter = ('academic_year', 'trimester', 'status', 'clearance_status')
    search_fields = ('student__user__username',)
    readonly_fields = ('balance',)
    autocomplete_fields = ('student',)
