from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/accounts/", include("accounts.urls")),
    path("api/curriculum/", include("skillapp_core.curriculum.urls")),
    path("api/practice/", include("skillapp_core.practice.urls")),
    path("api/submissions/", include("skillapp_core.submissions.urls")),
    path("api/rewards/", include("skillapp_core.rewards.urls")),
    path("api/notifications/", include("skillapp_core.notifications.urls")),
    path("api/media/", include("skillapp_core.media_pipeline.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
