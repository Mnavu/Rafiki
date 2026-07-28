from django.urls import path

from .views import MentorInboxView, MySubmissionsView, SubmissionReviewView, SubmitMilestoneView

app_name = "submissions"

urlpatterns = [
    path("milestones/<int:milestone_id>/submit/", SubmitMilestoneView.as_view(), name="submit-milestone"),
    path("mine/", MySubmissionsView.as_view(), name="mine"),
    path("inbox/", MentorInboxView.as_view(), name="inbox"),
    path("<int:submission_id>/review/", SubmissionReviewView.as_view(), name="review"),
]
