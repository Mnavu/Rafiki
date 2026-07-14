from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MentorLearnerLink, User
from .serializers import LinkedLearnerSerializer, MeSerializer


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(MeSerializer(request.user).data)

    def patch(self, request):
        serializer = MeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class MentorLearnersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not getattr(request.user, "is_mentor", False):
            return Response([])
        learner_ids = MentorLearnerLink.objects.filter(mentor=request.user).values_list("learner_id", flat=True)
        learners = User.objects.filter(id__in=learner_ids)
        return Response(LinkedLearnerSerializer(learners, many=True).data)
