from django.urls import path

from .views import BadgeCatalogView, MyRewardsView

app_name = "rewards"

urlpatterns = [
    path("mine/", MyRewardsView.as_view(), name="mine"),
    path("badges/", BadgeCatalogView.as_view(), name="badges"),
]
