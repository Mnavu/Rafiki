import os
from django.core.asgi import get_asgi_application

# Set the settings module before importing Channels
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'edu_assist.settings')

# Initialize Django ASGI application early to ensure the AppRegistry
# is populated before importing code that may rely on ORM models.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from channels.security.websocket import AllowedHostsOriginValidator
from core.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
    # Django's standard HTTP routing
    "http": django_asgi_app,
    
    # Channels real-time WebSocket routing
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(
                websocket_urlpatterns
            )
        )
    ),
})