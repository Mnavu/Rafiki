from django.urls import path
from .views import AskView, FeedbackView

app_name = 'chatbot'

urlpatterns = [
    path('ask/', AskView.as_view(), name='ask'),
    path('feedback/', FeedbackView.as_view(), name='feedback'),
]
