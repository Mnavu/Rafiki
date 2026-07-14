from django.urls import path

from .views import MyNotificationsView

app_name = "notifications"

urlpatterns = [
    path("mine/", MyNotificationsView.as_view(), name="mine"),
]
