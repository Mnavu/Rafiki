# from core.views import index
from core.views.devices import DeviceRegistrationView
from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.urls import path, include, re_path
from django.conf import settings
from django.views.generic import RedirectView
from django.conf.urls.static import static
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
    TokenBlacklistView,
)
from users.auth import CustomTokenObtainPairView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/core/", include("core.urls")),
    path("api/calendar/", include("core.urls_calendar")),
    path("api/users/", include("users.urls")),
    path("api/learning/", include("learning.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/finance/", include("finance.urls")),
    path("api/repository/", include("repository.urls")),
    path("api/communications/", include("communications.urls")),
    path("api/rewards/", include("rewards.urls")),
    path("api/chatbot/", include("chatbot.urls")),
    path("api/devices/register/", DeviceRegistrationView.as_view(), name="device-register"),
    # Auth helpers for browsable API
    path("api-auth/", include("rest_framework.urls")),
    # JWT auth endpoints
    path("api/token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("api/token/blacklist/", TokenBlacklistView.as_view(), name="token_blacklist"),
    # API schema and docs
    path("api/schema/", staff_member_required(SpectacularAPIView.as_view()), name="schema"),
    path(
        "api/docs/",
        staff_member_required(SpectacularSwaggerView.as_view(url_name="schema")),
        name="swagger-ui",
    ),
    path("", RedirectView.as_view(url="/admin/", permanent=False)),
    #path("", index),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    media_prefix = settings.MEDIA_URL.lstrip("/")
    urlpatterns += [
        re_path(
            rf"^{media_prefix}(?P<path>.*)$",
            serve,
            {"document_root": settings.MEDIA_ROOT},
        )
    ]
