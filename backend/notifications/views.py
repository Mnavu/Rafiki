from rest_framework import permissions, viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import ScopedListMixin
from core.permissions import IsSelfOrElevated
from users.models import User

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(ScopedListMixin, viewsets.ModelViewSet):
    queryset = Notification.objects.select_related("user").order_by("-created_at")
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated, IsSelfOrElevated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        status_filter = self.request.query_params.get("status")
        if user.role in [User.Roles.ADMIN, User.Roles.HOD, User.Roles.RECORDS, User.Roles.FINANCE] or user.is_staff:
            user_id = self.request.query_params.get("user_id")
            if user_id:
                qs = qs.filter(user_id=user_id)
            if status_filter:
                qs = qs.filter(status=status_filter)
            return qs
        qs = qs.filter(user=user)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    @action(detail=False, methods=['post'])
    def schedule(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if notification.status != Notification.Status.READ:
            notification.status = Notification.Status.READ
            notification.save(update_fields=["status", "updated_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        updated = self.get_queryset().exclude(status=Notification.Status.READ).update(
            status=Notification.Status.READ
        )
        return Response({"detail": "Notifications marked as read.", "updated": updated})
