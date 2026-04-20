"""
Google OAuth sign-in.

The frontend obtains a Google ID token (JWT) via Google Identity Services and
POSTs it to this endpoint. We verify the token against Google's public keys
(signature, issuer, audience, exp) using the `google-auth` library, then
get-or-create a local User keyed on verified email. The `post_save` signal
in `signals.py` auto-assigns the default `User` group.

Why not dj-rest-auth + django-allauth: those bring 15+ transitive deps for a
single flow. `google-auth` is ~200 LOC of verification logic that we'd
otherwise have to reimplement ourselves.
"""
import secrets
from typing import Optional

from django.conf import settings
from django.contrib.auth.models import User
from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from .auth_views import _serialize_user
from .throttles import LoginRateThrottle


def _verify(credential: str, audience: Optional[str]) -> dict:
    """Verify a Google ID token and return its payload.

    `google-auth` raises `ValueError` for any verification failure — bad
    signature, wrong audience, expired token, wrong issuer. Callers should
    catch that and return 401.
    """
    if not audience:
        # Misconfig, not user error — fail loud rather than accept any token.
        raise RuntimeError("GOOGLE_OAUTH_CLIENT_ID is not configured on the server.")
    # 10s clock skew: legitimate tokens minted just before our clock ticks
    # shouldn't be rejected as "iat in the future".
    return id_token.verify_oauth2_token(
        credential,
        google_requests.Request(),
        audience,
        clock_skew_in_seconds=10,
    )


def _unique_username_from_email(email: str) -> str:
    """Derive a collision-free Django username from a verified Google email."""
    base = (email.split("@")[0] or "user").lower()
    base = "".join(c if c.isalnum() or c == "_" else "_" for c in base)[:24] or "user"
    candidate = base
    i = 0
    while User.objects.filter(username__iexact=candidate).exists():
        i += 1
        candidate = f"{base}{i}"[:30]
    return candidate


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginRateThrottle])
def google_login(request):
    """Exchange a Google ID token for Fibonacci JWT tokens.

    Request body: `{"credential": "<google-id-token-jwt>"}`
    Returns: `{access, refresh, user}` — same shape as /api/auth/login/.
    """
    credential = (request.data or {}).get("credential")
    if not credential:
        return Response(
            {"detail": "Missing 'credential' (Google ID token)."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    audience = getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "")
    try:
        payload = _verify(credential, audience)
    except ValueError as exc:
        return Response(
            {"detail": f"Invalid Google token: {exc}"},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    email = (payload.get("email") or "").strip().lower()
    if not email or not payload.get("email_verified", False):
        return Response(
            {"detail": "Google account email must be verified."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    given = (payload.get("given_name") or "")[:30]
    family = (payload.get("family_name") or "")[:30]

    with transaction.atomic():
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            username = _unique_username_from_email(email)
            # Random password: the OAuth user never signs in with it, but
            # Django requires a hashable password field. A real hash beats
            # set_unusable_password() — users who later add a local password
            # via "change password" flow get a real credential immediately.
            user = User.objects.create_user(
                username=username,
                email=email,
                password=secrets.token_urlsafe(32),
                first_name=given,
                last_name=family,
            )

    refresh = RefreshToken.for_user(user)
    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": _serialize_user(user),
        },
        status=status.HTTP_200_OK,
    )
