from django.db import models
from django.contrib.auth.models import User


class Strategy(models.Model):
    """User-defined trading strategies (e.g., Breakout, Swing, Scalping)."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='strategies')
    name = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Trade(models.Model):
    """Detailed record of a single trade."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='trades')
    symbol = models.CharField(max_length=20)
    strategy = models.ForeignKey(Strategy, on_delete=models.SET_NULL, null=True, blank=True)
    trade_date = models.DateTimeField()  # When trade opened
    close_date = models.DateTimeField(null=True, blank=True)  # When trade closed (optional)
    entry_price = models.DecimalField(max_digits=12, decimal_places=4)
    exit_price = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    position_size = models.IntegerField(default=0, help_text="Number of shares or contracts")
    fees = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    pnl = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    pnl_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    notes = models.TextField(blank=True)
    tags = models.CharField(max_length=100, blank=True, help_text="Comma-separated tags (e.g., 'AAPL, earnings')")
    screenshot = models.URLField(blank=True, help_text="Optional link to chart image or screenshot")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        """Auto-calculate PnL and PnL% when saving."""
        if self.exit_price and self.entry_price and self.position_size:
            self.pnl = (self.exit_price - self.entry_price) * self.position_size - float(self.fees)
            if self.entry_price > 0:
                self.pnl_percent = ((self.exit_price - self.entry_price) / self.entry_price) * 100
        super().save(*args, **kwargs)

    @property
    def is_winner(self):
        return self.pnl > 0

    def __str__(self):
        return f"{self.symbol} ({self.trade_date.strftime('%Y-%m-%d')})"