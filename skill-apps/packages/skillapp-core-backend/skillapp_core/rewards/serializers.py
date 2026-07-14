from rest_framework import serializers

from .models import Award, Badge


class BadgeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Badge
        fields = ["id", "code", "title", "description", "icon_url", "criteria_hint"]


class AwardSerializer(serializers.ModelSerializer):
    badge_title = serializers.CharField(source="badge.title", read_only=True, default="")

    class Meta:
        model = Award
        fields = ["id", "points", "reason", "badge", "badge_title", "created_at"]
