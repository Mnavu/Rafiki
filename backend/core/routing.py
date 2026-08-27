from django.urls import re_path
# You will eventually import your WebSocket consumers here
# from . import consumers 

websocket_urlpatterns = [
    # Example route: The Next.js dashboard will connect to wss://yourdomain.com/ws/escalations/
    # re_path(r'ws/escalations/$', consumers.EscalationQueueConsumer.as_asgi()),
]