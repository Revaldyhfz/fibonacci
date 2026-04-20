from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CryptoAssetViewSet, StrategyViewSet, TradeViewSet
from .health import health_check, readiness_check, liveness_check
from .auth_views import me, admin_users, admin_overview
from .registration_views import register
from .google_auth_views import google_login

router = DefaultRouter()
router.register(r'strategies', StrategyViewSet, basename='strategy')
router.register(r'trades', TradeViewSet, basename='trade')
router.register(r'crypto-assets', CryptoAssetViewSet, basename='crypto-asset')

urlpatterns = [
    path('health/', health_check, name='health'),
    path('ready/', readiness_check, name='readiness'),
    path('live/', liveness_check, name='liveness'),

    # Auth-adjacent
    path('auth/me/', me, name='auth-me'),
    path('auth/register/', register, name='auth-register'),
    path('auth/google/', google_login, name='auth-google'),

    # Admin-only
    path('admin/users/', admin_users, name='admin-users'),
    path('admin/overview/', admin_overview, name='admin-overview'),

    path('', include(router.urls)),
]
