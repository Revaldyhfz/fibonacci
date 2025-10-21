from django.db import models
from django.contrib.auth.models import User
from decimal import Decimal


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
    
    DIRECTION_CHOICES = [
        ('LONG', 'Long'),
        ('SHORT', 'Short'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='trades')
    symbol = models.CharField(max_length=20)
    strategy = models.ForeignKey(Strategy, on_delete=models.SET_NULL, null=True, blank=True)
    direction = models.CharField(max_length=5, choices=DIRECTION_CHOICES, default='LONG')
    
    trade_date = models.DateTimeField()  # When trade opened
    time = models.TimeField(editable=False, null=True, blank=True)  # Auto-set trade time
    close_date = models.DateTimeField(null=True, blank=True)  # When trade closed
    
    entry_price = models.DecimalField(max_digits=12, decimal_places=4)
    exit_price = models.DecimalField(max_digits=12, decimal_places=4, null=True, blank=True)
    position_size = models.IntegerField(default=0, help_text="Number of shares or contracts")
    fees = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    pnl = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    pnl_percent = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    
    notes = models.TextField(blank=True)
    tags = models.CharField(max_length=100, blank=True, help_text="Comma-separated tags")
    screenshot = models.URLField(blank=True, help_text="Optional link to chart image")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        """Auto-calculate PnL and PnL% when saving (decimal-safe)."""
        if self.exit_price and self.entry_price and self.position_size:
            entry = Decimal(self.entry_price)
            exit = Decimal(self.exit_price)
            size = Decimal(self.position_size)
            fees = Decimal(self.fees or 0)
            
            # Calculate based on direction
            if self.direction == 'LONG':
                # Long: Buy at entry, sell at exit
                # Profit when exit > entry
                self.pnl = (exit - entry) * size - fees
                if entry > 0:
                    self.pnl_percent = ((exit - entry) / entry) * Decimal(100)
            else:  # SHORT
                # Short: Sell at entry, buy back at exit
                # Profit when entry > exit
                self.pnl = (entry - exit) * size - fees
                if entry > 0:
                    self.pnl_percent = ((entry - exit) / entry) * Decimal(100)
        
        # Auto-fill time from trade_date
        if self.trade_date and not self.time:
            self.time = self.trade_date.time()
        
        super().save(*args, **kwargs)
    
    @property
    def is_winner(self):
        """Return True if trade has positive PnL."""
        try:
            return self.pnl > 0
        except (TypeError, ValueError):
            return False
    
    def __str__(self):
        return f"{self.symbol} ({self.trade_date.strftime('%Y-%m-%d')})"