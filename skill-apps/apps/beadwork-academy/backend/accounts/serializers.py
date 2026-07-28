from rest_framework import serializers

from .models import LearnerProfile, MentorLearnerLink, MentorProfile, User


class MeSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "role",
            "prefers_simple_language",
            "prefers_high_contrast",
            "speech_rate",
        ]


class LinkedLearnerSerializer(serializers.ModelSerializer):
    learner_username = serializers.CharField(source="username")
    learner_id = serializers.IntegerField(source="id")

    class Meta:
        model = User
        fields = ["learner_id", "learner_username"]
