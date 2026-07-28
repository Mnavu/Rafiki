from django.urls import path

from .views import LessonDetailView, ModuleLessonListView, ModuleListView

app_name = "curriculum"

urlpatterns = [
    path("modules/", ModuleListView.as_view(), name="module-list"),
    path("modules/<str:module_code>/lessons/", ModuleLessonListView.as_view(), name="module-lessons"),
    path("lessons/<str:lesson_code>/", LessonDetailView.as_view(), name="lesson-detail"),
]
