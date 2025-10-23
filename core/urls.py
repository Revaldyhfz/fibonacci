from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CryptoAssetViewSet, StrategyViewSet, TradeViewSet
from .health import health_check, readiness_check, liveness_check

router = DefaultRouter()
router.register(r'strategies', StrategyViewSet, basename='strategy')
router.register(r'trades', TradeViewSet, basename='trade')
router.register(r'crypto-assets', CryptoAssetViewSet, basename='crypto-asset')

urlpatterns = [
    path('health/', health_check, name='health'),
    path('ready/', readiness_check, name='readiness'),
    path('live/', liveness_check, name='liveness'),
    path('', include(router.urls)),
]