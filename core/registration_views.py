"""
Public user registration.

Keeps onboarding frictionless — any visitor can create an account. The signal
in `signals.py` auto-assigns the new user to the `User` group. Admin
promotion is a separate explicit step (management command or admin endpoint).
"""

from django.contrib.auth.models import User
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .auth_views import _serialize_user


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("username", "email", "password")

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Username already taken.")
        return value

    def validate_email(self, value):
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Email already registered.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """Create a new account and return JWT tokens so the client is logged in."""
    serializer = RegistrationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()

    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": _serialize_user(user),
        },
        status=status.HTTP_201_CREATED,
    )
