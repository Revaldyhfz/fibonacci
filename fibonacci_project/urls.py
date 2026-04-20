"""Root URL conf + cross-service proxies.

Proxies forward user-scoped requests to the analytics + portfolio microservices.
Both proxies require a valid JWT — the upstream services sit on the internal
network and trust the Django edge to gate access.
"""
import logging
import os

import requests
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import include, path
from django.views.decorators.csrf import csrf_exempt
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)

from core.throttles import LoginRateThrottle


class ThrottledTokenObtainPairView(TokenObtainPairView):
    """Login endpoint with an IP-keyed 'login' throttle scope (10/min).

    Slows down credential-stuffing without hurting legitimate retries.
    """
    throttle_classes = [LoginRateThrottle]


class ThrottledTokenRefreshView(TokenRefreshView):
    """Refresh endpoint reuses the login scope — a hot refresh storm looks
    indistinguishable from a brute-force attempt against the same IP."""
    throttle_classes = [LoginRateThrottle]

logger = logging.getLogger(__name__)

ANALYTICS_SERVICE_URL = os.getenv('ANALYTICS_SERVICE_URL', 'http://analytics-service:8001')
PORTFOLIO_SERVICE_URL = os.getenv('PORTFOLIO_SERVICE_URL', 'http://portfolio-service:8002')


def _require_jwt(view_func):
    """Gate a function-based view behind a valid SimpleJWT access token."""

    def wrapped(request, *args, **kwargs):
        try:
            auth_result = JWTAuthentication().authenticate(request)
        except AuthenticationFailed as exc:
            return JsonResponse({"error": str(exc)}, status=401)
        if auth_result is None:
            return JsonResponse({"error": "Authentication required"}, status=401)
        request.user, request.auth = auth_result
        return view_func(request, *args, **kwargs)

    wrapped.__name__ = view_func.__name__
    return wrapped


def _forward(request, upstream_url: str):
    headers = {'Content-Type': 'application/json'}
    if 'Authorization' in request.headers:
        headers['Authorization'] = request.headers['Authorization']
    try:
        if request.method == 'GET':
            resp = requests.get(upstream_url, params=request.GET, headers=headers, timeout=30)
        else:
            resp = requests.post(
                upstream_url,
                data=request.body,
                params=request.GET,
                headers=headers,
                timeout=30,
            )
    except requests.exceptions.Timeout:
        return JsonResponse({"error": "Upstream service timeout"}, status=504)
    except requests.exceptions.RequestException as exc:
        logger.warning("proxy error upstream=%s: %s", upstream_url, exc)
        return JsonResponse({"error": "Upstream service unavailable"}, status=503)
    return HttpResponse(
        resp.content,
        status=resp.status_code,
        content_type=resp.headers.get('content-type'),
    )


@_require_jwt
def analytics_proxy(request, path):
    return _forward(request, f"{ANALYTICS_SERVICE_URL}/{path}")


@csrf_exempt
@_require_jwt
def portfolio_proxy(request, path):
    return _forward(request, f"{PORTFOLIO_SERVICE_URL}/{path}")


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', ThrottledTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', ThrottledTokenRefreshView.as_view(), name='token_refresh'),
    path('api/', include('core.urls')),
    path('analytics/<path:path>', analytics_proxy),
    path('portfolio/<path:path>', portfolio_proxy),
]