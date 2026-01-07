from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from datetime import timedelta
from django.utils import timezone

from core.models import AuditLog
from communications.models import SupportChatMessage
from notifications.models import Notification

class AdminAnalyticsView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        one_week_ago = timezone.now() - timedelta(days=7)

        weekly_logins = AuditLog.objects.filter(
            action='user_login',
            created_at__gte=one_week_ago
        ).count()

        chatbot_questions = SupportChatMessage.objects.filter(author_is_user=True).count()

        alerts_sent = Notification.objects.filter(status=Notification.Status.SENT).count()

        data = {
            'weekly_logins': weekly_logins,
            'chatbot_questions': chatbot_questions,
            'alerts_sent': alerts_sent,
        }
        return Response(data)
