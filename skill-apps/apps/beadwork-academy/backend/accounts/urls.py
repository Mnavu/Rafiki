from django.urls import path

from .views import MeView, MentorLearnersView

app_name = "accounts"

urlpatterns = [
    path("me/", MeView.as_view(), name="me"),
    path("mentor/learners/", MentorLearnersView.as_view(), name="mentor-learners"),
]
