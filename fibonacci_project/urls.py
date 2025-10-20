from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from django.http import HttpResponse
import requests

def analytics_proxy(request, path):
    """Proxy requests to the analytics microservice"""
    try:
        url = f"http://127.0.0.1:8001/{path}"
        if request.method == 'GET':
            resp = requests.get(url, params=request.GET)
        else:
            resp = requests.post(url, json=request.body, headers={'Content-Type': 'application/json'})
        return HttpResponse(resp.content, status=resp.status_code, content_type=resp.headers.get('content-type'))
    except Exception as e:
        return HttpResponse(f"Analytics service unavailable: {str(e)}", status=503)

urlpatterns = [
    path('admin/', admin.site.urls),

    # Authentication
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Core app routes
    path('api/', include('core.urls')),
    
    # Analytics microservice proxy
    path('analytics/<path:path>', analytics_proxy),
]