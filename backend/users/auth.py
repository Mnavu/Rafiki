from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from core.models import AuditLog
from .models import User
from .serializers import UserSerializer
#...
        if user.totp_enabled:
            if not totp_code or not user.verify_totp(totp_code):
                raise AuthenticationFailed("A valid authenticator code is required.")
        
        AuditLog.objects.create(
            actor_user=user,
            action="user_login",
            target_table="users_user",
            target_id=str(user.id)
        )
        
        data["user"] = UserSerializer(user).data
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
