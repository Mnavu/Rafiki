from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView

from core.models import AuditLog
from .models import User
from .serializers import UserSerializer

# 1. Define the Serializer Class FIRST (Spelling verified)
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Call the parent validation first to check password/username
        data = super().validate(attrs)
        
        user: User = self.user
        request = self.context.get("request")
        
        # Safe way to get totp_code from attrs or request data
        totp_code = attrs.get("totp_code") or (request.data.get("totp_code") if request else None)

        # Check TOTP if enabled
        if user.totp_enabled:
            if not totp_code or not user.verify_totp(totp_code):
                raise AuthenticationFailed("A valid authenticator code is required.")
        
        # Log the login action
        AuditLog.objects.create(
            actor_user=user,
            action="user_login",
            target_table="users_user",
            target_id=str(user.id)
        )
        
        # Return user data
        data["user"] = UserSerializer(user).data
        return data

# 2. Define the View Class SECOND (Uses the serializer defined above)
class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer