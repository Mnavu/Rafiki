from rest_framework.routers import DefaultRouter
from .views import ThreadViewSet, MessageViewSet, CourseChatroomViewSet, ChatMessageViewSet
from .views import SupportChatAPIView, CreateDirectMessageView, CreateStudentDirectMessageView

router = DefaultRouter()
router.register(r"threads", ThreadViewSet, basename="communication-thread")
router.register(r"messages", MessageViewSet, basename="communication-message")
router.register(r"chatrooms", CourseChatroomViewSet, basename="course-chatroom")
router.register(r"chat-messages", ChatMessageViewSet, basename="chat-message")

urlpatterns = router.urls

from django.urls import path

urlpatterns += [
	path("support/chat/", SupportChatAPIView.as_view(), name="support-chat"),
    path("threads/direct-message/", CreateDirectMessageView.as_view(), name="create-direct-message"),
    path("threads/student-direct-message/", CreateStudentDirectMessageView.as_view(), name="create-student-direct-message"),
]
