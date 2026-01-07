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
)

router = DefaultRouter()
router.register(r'departments', DepartmentViewSet, basename='department')
router.register(r'dashboard', HodDashboardViewSet, basename='hod-dashboard')
router.register(r'hods', HODViewSet, basename='hod')
router.register(r'admin/pipeline', AdminPipelineView, basename='admin-pipeline') # Added

urlpatterns = [
    path("health/", health),
    path("help/", help_view),
    path("about/", about_view),
    path("transcribe/", transcribe_audio),
    path("api/admin/analytics/", AdminAnalyticsView.as_view(), name="admin-analytics"),
    path("api/", include(router.urls)),
]
