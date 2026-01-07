from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from ..models import Quiz, StudentAnswer, Choice
from ..serializers import QuizSerializer, StudentAnswerSerializer
from ..progress_models import CompletionRecord

class QuizViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Quiz.objects.all()
    serializer_class = QuizSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=['post'])
    def submit_answers(self, request, pk=None):
        quiz = self.get_object()
        user = request.user
        
        try:
            student_profile = user.student_profile
        except AttributeError:
            return Response({"error": "Only students can submit quizzes."}, status=status.HTTP_403_FORBIDDEN)

        answers_data = request.data.get('answers', [])
        if not answers_data:
            return Response({"error": "No answers provided."}, status=status.HTTP_400_BAD_REQUEST)

        # Assuming answers_data is a list of {'question': id, 'choice': id}
        serializer = StudentAnswerSerializer(data=answers_data, many=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        # Delete previous answers for this quiz
        StudentAnswer.objects.filter(student=student_profile, question__quiz=quiz).delete()
        
        # Save new answers
        for answer_data in serializer.validated_data:
            StudentAnswer.objects.create(
                student=student_profile,
                question=answer_data['question'],
                choice=answer_data['choice']
            )

        # Calculate score
        correct_answers = 0
        total_questions = quiz.questions.count()
        for answer in StudentAnswer.objects.filter(student=student_profile, question__quiz=quiz):
            if answer.choice.is_correct:
                correct_answers += 1
        
        score = (correct_answers / total_questions) * 100 if total_questions > 0 else 0

        # Create completion record
        CompletionRecord.objects.update_or_create(
            student=student_profile,
            programme=student_profile.programme,
            unit=quiz.unit,
            quiz=quiz,
            defaults={
                'score': score,
                'completion_type': 'auto_tracked',
            }
        )

        return Response({
            'score': score,
            'correct_answers': correct_answers,
            'total_questions': total_questions
        }, status=status.HTTP_200_OK)
