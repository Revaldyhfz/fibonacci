from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import StrategyViewSet, TradeViewSet

router = DefaultRouter()
router.register(r'strategies', StrategyViewSet, basename='strategy')
router.register(r'trades', TradeViewSet, basename='trade')

urlpatterns = [
    path('', include(router.urls)),
]