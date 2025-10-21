from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import CryptoAsset, Strategy, Trade
from .serializers import CryptoAssetSerializer, StrategySerializer, TradeSerializer
import requests




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
        
        if total == 0:
            return Response({
                "total_trades": 0,
                "wins": 0,
                "winrate_percent": 0,
                "total_pnl": 0,
                "avg_win": 0,
                "avg_loss": 0,
                "best_trade": None,
                "worst_trade": None,
            })
        
        total_pnl = sum(float(t.pnl) for t in qs)
        wins = [t for t in qs if t.is_winner]
        losses = [t for t in qs if not t.is_winner and t.pnl is not None]
        
        wins_count = len(wins)
        winrate = (wins_count / total * 100) if total else 0.0
        
        # Calculate average win/loss
        avg_win = sum(float(t.pnl) for t in wins) / wins_count if wins_count > 0 else 0
        avg_loss = sum(float(t.pnl) for t in losses) / len(losses) if losses else 0
        
        # Find best and worst trades
        all_trades = list(qs)
        best_trade = max(all_trades, key=lambda t: float(t.pnl)) if all_trades else None
        worst_trade = min(all_trades, key=lambda t: float(t.pnl)) if all_trades else None
        
        return Response({
            "total_trades": total,
            "wins": wins_count,
            "winrate_percent": round(winrate, 2),
            "total_pnl": float(total_pnl),
            "avg_win": round(avg_win, 2),
            "avg_loss": round(avg_loss, 2),
            "best_trade": {
                "symbol": best_trade.symbol,
                "pnl": float(best_trade.pnl),
                "trade_date": best_trade.trade_date.isoformat()
            } if best_trade else None,
            "worst_trade": {
                "symbol": worst_trade.symbol,
                "pnl": float(worst_trade.pnl),
                "trade_date": worst_trade.trade_date.isoformat()
            } if worst_trade else None,
        })
        
        
class CryptoAssetViewSet(viewsets.ModelViewSet):
    serializer_class = CryptoAssetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CryptoAsset.objects.filter(user=self.request.user)

    @action(detail=False, methods=['get'])
    def portfolio_summary(self, request):
        """Get complete portfolio with live prices"""
        assets = self.get_queryset()
        
        # Prepare data for portfolio service
        asset_list = [
            {
                'symbol': asset.symbol,
                'amount': float(asset.amount),
                'purchase_price': float(asset.purchase_price) if asset.purchase_price else None,
                'purchase_date': asset.purchase_date.isoformat() if asset.purchase_date else None,
                'notes': asset.notes
            }
            for asset in assets
        ]
        
        if not asset_list:
            return Response({
                'total_value_usd': 0,
                'total_cost': 0,
                'total_pnl': 0,
                'total_pnl_percent': 0,
                'assets': []
            })
        
        # Call portfolio microservice
        try:
            response = requests.post(
                'http://127.0.0.1:8002/portfolio/calculate',
                json=asset_list,
                timeout=15
            )
            response.raise_for_status()
            return Response(response.json())
        except Exception as e:
            return Response(
                {'error': f'Portfolio service unavailable: {str(e)}'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )