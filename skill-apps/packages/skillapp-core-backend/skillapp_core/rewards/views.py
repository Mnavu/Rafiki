from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Award, Badge
from .serializers import AwardSerializer, BadgeSerializer
from .services import stars_total_for


class MyRewardsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        history = Award.objects.filter(learner=request.user).select_related("badge")
        earned_badge_ids = list(history.exclude(badge__isnull=True).values_list("badge_id", flat=True))
        return Response(
            {
                "stars": stars_total_for(request.user),
                "history": AwardSerializer(history, many=True).data,
                "earned_badge_ids": earned_badge_ids,
            }
        )


class BadgeCatalogView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(BadgeSerializer(Badge.objects.all(), many=True).data)
