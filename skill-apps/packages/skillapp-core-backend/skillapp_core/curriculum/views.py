from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Lesson, Module
from .serializers import LessonDetailSerializer, LessonListSerializer, ModuleListSerializer


def _completed_module_ids(learner):
    """Module ids where every lesson has a completed LearnerLessonProgress row.

    Imported lazily to avoid a hard import-time dependency between the
    curriculum and practice apps (both are separate, independently reusable
    Django apps in this package).
    """
    from skillapp_core.practice.models import LearnerLessonProgress

    completed = set()
    for module in Module.objects.prefetch_related("lessons"):
        lesson_ids = list(module.lessons.values_list("id", flat=True))
        if not lesson_ids:
            continue
        done_count = LearnerLessonProgress.objects.filter(
            learner=learner, lesson_id__in=lesson_ids, status=LearnerLessonProgress.Status.COMPLETED
        ).count()
        if done_count == len(lesson_ids):
            completed.add(module.id)
    return completed


class ModuleListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        completed_ids = _completed_module_ids(request.user)
        modules = Module.objects.all()
        data = []
        for module in modules:
            locked = bool(module.unlocks_after_id) and module.unlocks_after_id not in completed_ids
            payload = ModuleListSerializer(module).data
            payload["locked"] = locked
            payload["completed"] = module.id in completed_ids
            data.append(payload)
        return Response(data)


class ModuleLessonListView(generics.ListAPIView):
    serializer_class = LessonListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Lesson.objects.filter(module__code=self.kwargs["module_code"]).order_by("order")


class LessonDetailView(generics.RetrieveAPIView):
    serializer_class = LessonDetailSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = "code"
    lookup_url_kwarg = "lesson_code"
    queryset = Lesson.objects.all()
