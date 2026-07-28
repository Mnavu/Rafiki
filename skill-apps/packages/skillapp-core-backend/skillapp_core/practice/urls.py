from django.urls import path

from .views import CompleteChecklistStepView, MyProgressView

app_name = "practice"

urlpatterns = [
    path("checklist/<int:step_id>/complete/", CompleteChecklistStepView.as_view(), name="checklist-complete"),
    path("progress/", MyProgressView.as_view(), name="my-progress"),
]
