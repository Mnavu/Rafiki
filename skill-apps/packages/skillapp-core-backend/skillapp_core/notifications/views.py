from django.utils import timezone
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class MyNotificationsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = Notification.objects.filter(recipient=request.user)
        return Response(NotificationSerializer(rows, many=True).data)

    def post(self, request):
        """Mark all unread notifications as read."""
        Notification.objects.filter(recipient=request.user, read_at__isnull=True).update(read_at=timezone.now())
        return Response({"marked_read": True})
