from django.db import models
from core.models import TimeStampedModel
from .models import CurriculumUnit

class Quiz(TimeStampedModel):
    unit = models.ForeignKey(CurriculumUnit, on_delete=models.CASCADE, related_name='quizzes')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.title

class Question(TimeStampedModel):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField()

    def __str__(self):
        return self.text

class Choice(TimeStampedModel):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='choices')
    text = models.CharField(max_length=255)
    is_correct = models.BooleanField(default=False)

    def __str__(self):
        return self.text

class StudentAnswer(TimeStampedModel):
    student = models.ForeignKey('users.Student', on_delete=models.CASCADE, related_name='quiz_answers')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='answers')
    choice = models.ForeignKey(Choice, on_delete=models.CASCADE, related_name='answers')

    class Meta:
        unique_together = ('student', 'question')
