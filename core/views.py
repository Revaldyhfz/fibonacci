from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Strategy, Trade
from .serializers import StrategySerializer, TradeSerializer


class StrategyViewSet(viewsets.ModelViewSet):
    serializer_class = StrategySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Strategy.objects.filter(user=self.request.user).order_by('-created_at')


class TradeViewSet(viewsets.ModelViewSet):
    serializer_class = TradeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Trade.objects.filter(user=self.request.user).order_by('-trade_date')

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Quick analytics endpoint for total trades, winrate, and pnl."""
        qs = self.get_queryset()
        total = qs.count()
        total_pnl = sum(t.pnl for t in qs)
        wins = sum(1 for t in qs if t.is_winner)
        winrate = (wins / total * 100) if total else 0.0
        return Response({
            "total_trades": total,
            "wins": wins,
            "winrate_percent": round(winrate, 2),
            "total_pnl": float(total_pnl),
        })