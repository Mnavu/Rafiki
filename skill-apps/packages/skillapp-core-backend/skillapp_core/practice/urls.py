from django.urls import path

from .views import (
    CompleteChecklistStepView,
    LearnerProgressForMentorView,
    LessonStepStatusView,
    MyProgressView,
)

app_name = "practice"

urlpatterns = [
    path("checklist/<int:step_id>/complete/", CompleteChecklistStepView.as_view(), name="checklist-complete"),
    path("lessons/<str:lesson_code>/step-status/", LessonStepStatusView.as_view(), name="lesson-step-status"),
    path("progress/", MyProgressView.as_view(), name="my-progress"),
    path("progress/<int:learner_id>/", LearnerProgressForMentorView.as_view(), name="learner-progress-for-mentor"),
]
