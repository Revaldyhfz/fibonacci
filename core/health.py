# core/health.py - Health Check Endpoints for Django
from django.http import JsonResponse
from django.db import connections
from django.db.utils import OperationalError
import requests
import os

def health_check(request):
    """Basic health check - service is running"""
    return JsonResponse({
        "status": "healthy",
        "service": "main-service",
        "version": "1.0.0"
    })

def readiness_check(request):
    """Readiness check - service is ready to accept traffic"""
    checks = {
        "database": False,
        "analytics_service": False,
        "portfolio_service": False
    }
    
    # Check database connection
    try:
        db_conn = connections['default']
        db_conn.cursor()
        checks["database"] = True
    except OperationalError:
        checks["database"] = False
    
    # Check analytics service
    try:
        analytics_url = os.getenv('ANALYTICS_SERVICE_URL', 'http://127.0.0.1:8001')
        resp = requests.get(f"{analytics_url}/health", timeout=5)
        checks["analytics_service"] = resp.status_code == 200
    except:
        checks["analytics_service"] = False
    
    # Check portfolio service
    try:
        portfolio_url = os.getenv('PORTFOLIO_SERVICE_URL', 'http://127.0.0.1:8002')
        resp = requests.get(f"{portfolio_url}/health", timeout=5)
        checks["portfolio_service"] = resp.status_code == 200
    except:
        checks["portfolio_service"] = False
    
    all_ready = all(checks.values())
    status_code = 200 if all_ready else 503
    
    return JsonResponse({
        "status": "ready" if all_ready else "not ready",
        "checks": checks
    }, status=status_code)

def liveness_check(request):
    """Liveness check - service should be restarted if this fails"""
    return JsonResponse({
        "status": "alive",
        "service": "main-service"
    })
