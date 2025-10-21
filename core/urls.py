from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CryptoAssetViewSet, StrategyViewSet, TradeViewSet

router = DefaultRouter()
router.register(r'strategies', StrategyViewSet, basename='strategy')
router.register(r'trades', TradeViewSet, basename='trade')
router.register(r'crypto-assets', CryptoAssetViewSet, basename='crypto-asset')

urlpatterns = [
    path('', include(router.urls)),
]