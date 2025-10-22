# fibonacci_project/urls.py - PATCHED with Environment Variables
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
import requests
import json
import os

# Environment-based service URLs (Kubernetes-ready)
ANALYTICS_SERVICE_URL = os.getenv('ANALYTICS_SERVICE_URL', 'http://127.0.0.1:8001')
PORTFOLIO_SERVICE_URL = os.getenv('PORTFOLIO_SERVICE_URL', 'http://127.0.0.1:8002')

def analytics_proxy(request, path):
    """Proxy requests to the analytics microservice"""
    try:
        url = f"{ANALYTICS_SERVICE_URL}/{path}"
        
        headers = {}
        if 'Authorization' in request.headers:
            headers['Authorization'] = request.headers['Authorization']
        headers['Content-Type'] = 'application/json'
        
        if request.method == 'GET':
            resp = requests.get(url, params=request.GET, headers=headers)
        else:
            resp = requests.post(url, data=request.body, headers=headers)
        
        return HttpResponse(resp.content, status=resp.status_code, content_type=resp.headers.get('content-type'))
    except Exception as e:
        return JsonResponse({"error": f"Analytics service unavailable: {str(e)}"}, status=503)

@csrf_exempt
def portfolio_proxy(request, path):
    """Proxy requests to the portfolio microservice"""
    try:
        url = f"{PORTFOLIO_SERVICE_URL}/{path}"
        
        query_params = request.GET.dict()
        
        headers = {}
        if 'Authorization' in request.headers:
            headers['Authorization'] = request.headers['Authorization']
        headers['Content-Type'] = 'application/json'
        
        print(f"🔄 Proxying {request.method} to portfolio service: {url}")
        print(f"   Query params: {query_params}")
        print(f"   Body preview: {request.body[:200] if request.body else 'empty'}")
        
        if request.method == 'GET':
            resp = requests.get(url, params=query_params, headers=headers, timeout=30)
        else:
            resp = requests.post(url, data=request.body, params=query_params, headers=headers, timeout=30)
        
        print(f"   Response status: {resp.status_code}")
        
        return HttpResponse(resp.content, status=resp.status_code, content_type=resp.headers.get('content-type'))
    except requests.exceptions.Timeout:
        return JsonResponse({"error": "Portfolio service timeout"}, status=504)
    except Exception as e:
        print(f"❌ Portfolio proxy error: {str(e)}")
        return JsonResponse({"error": f"Portfolio service unavailable: {str(e)}"}, status=503)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/', include('core.urls')),
    path('analytics/<path:path>', analytics_proxy),
    path('portfolio/<path:path>', portfolio_proxy),
]