from django.urls import path
from rest_framework.routers import DefaultRouter

from users.views import (
    UserViewSet,
    ParentStudentLinkViewSet,
    UserProvisionRequestViewSet,
    StudentViewSet,
    LecturerViewSet,
    me,
    password_reset_request,
    password_reset_confirm,
    password_change_self,
    totp_setup,
    totp_activate,
    totp_disable,
    assign_role,
    admin_create_user,
    admin_reset_password,
    provision_user,
    enroll_family,
)

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="user")
router.register(r"students", StudentViewSet, basename="student")
router.register(r"lecturers", LecturerViewSet, basename="lecturer")
router.register(r"parent-links", ParentStudentLinkViewSet, basename="parent-link")
router.register(r"provision-requests", UserProvisionRequestViewSet, basename="provision-request")

urlpatterns = router.urls + [
    path("me/", me, name="users-me"),
    path("password-reset/request/", password_reset_request, name="users-password-reset-request"),
    path("password-reset/confirm/", password_reset_confirm, name="users-password-reset-confirm"),
    path("password-reset/self/", password_change_self, name="users-password-change-self"),
    path("totp/setup/", totp_setup, name="users-totp-setup"),
    path("totp/activate/", totp_activate, name="users-totp-activate"),
    path("totp/disable/", totp_disable, name="users-totp-disable"),
    path("assign-role/", assign_role, name="users-assign-role"),
    path("admin-create/", admin_create_user, name="users-admin-create"),
    path("admin-reset-password/", admin_reset_password, name="users-admin-reset-password"),
    path("provision/", provision_user, name="users-provision"),
    path("enroll-family/", enroll_family, name="users-enroll-family"),
]
