from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PaymentViewSet, FinanceStatusViewSet

router = DefaultRouter()
router.register(r"payments", PaymentViewSet, basename="payment")
router.register(r"status", FinanceStatusViewSet, basename="finance-status")

urlpatterns = [
    path("", include(router.urls)),
]
