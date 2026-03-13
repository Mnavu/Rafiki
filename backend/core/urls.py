from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    health, 
    help_view, 
    about_view, 
    transcribe_audio, 
    DepartmentViewSet, 
    HodDashboardViewSet, 
    HODViewSet, 
    AdminPipelineView,
    AdminAnalyticsView,
    GovernanceTabulationsView,
    GovernanceActivityTimelineView,
    DataGovernancePolicyView,
    GovernanceReportViewSet,
    ReportScheduleViewSet,
    GovernanceAuditLogViewSet,
    RiskFlagViewSet,
    ApprovalRequestViewSet,
    RoleAlertPolicyViewSet,
)

router = DefaultRouter()
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'dashboard', HodDashboardViewSet, basename='hod-dashboard')
router.register(r'hods', HODViewSet, basename='hod')
router.register(r'admin/pipeline', AdminPipelineView, basename='admin-pipeline') # Added
router.register(r'admin/governance/reports', GovernanceReportViewSet, basename='governance-reports')
router.register(r'admin/governance/schedules', ReportScheduleViewSet, basename='governance-schedules')
router.register(r'admin/governance/audit-logs', GovernanceAuditLogViewSet, basename='governance-audit')
router.register(r'admin/governance/risk-flags', RiskFlagViewSet, basename='governance-risk')
router.register(r'admin/governance/approvals', ApprovalRequestViewSet, basename='governance-approvals')
router.register(r'admin/governance/alert-policies', RoleAlertPolicyViewSet, basename='governance-alert-policies')

urlpatterns = [
    path("health/", health),
    path("help/", help_view),
    path("about/", about_view),
    path("transcribe/", transcribe_audio),
    path("api/admin/analytics/", AdminAnalyticsView.as_view(), name="admin-analytics"),
    path("api/admin/governance/tabulations/", GovernanceTabulationsView.as_view(), name="governance-tabulations"),
    path("api/admin/governance/activity/", GovernanceActivityTimelineView.as_view(), name="governance-activity"),
    path("api/admin/governance/policy/", DataGovernancePolicyView.as_view(), name="governance-policy"),
    path("api/", include(router.urls)),
]
