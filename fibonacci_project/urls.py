from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from django.http import HttpResponse, JsonResponse
import requests
import json

def analytics_proxy(request, path):
    """Proxy requests to the analytics microservice"""
    try:
        url = f"http://127.0.0.1:8001/{path}"
        
        # Forward authorization header
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
    
def portfolio_proxy(request, path):
    """Proxy requests to the portfolio microservice - FIXED to pass auth headers"""
    try:
        url = f"http://127.0.0.1:8002/{path}"
        
        # Extract query parameters (like ?days=7)
        query_params = request.GET.dict()
        
        # Forward authorization header and other headers
        headers = {}
        if 'Authorization' in request.headers:
            headers['Authorization'] = request.headers['Authorization']
        headers['Content-Type'] = 'application/json'
        
        print(f"🔄 Proxying {request.method} to portfolio service: {url}")
        print(f"   Query params: {query_params}")
        print(f"   Headers: {headers}")
        
        if request.method == 'GET':
            resp = requests.get(url, params=query_params, headers=headers, timeout=30)
        else:
            # POST/PUT/DELETE
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

    # Authentication
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Core app routes
    path('api/', include('core.urls')),
    
    # Analytics microservice proxy
    path('analytics/<path:path>', analytics_proxy),
    
    # Portfolio microservice proxy
    path('portfolio/<path:path>', portfolio_proxy),
]