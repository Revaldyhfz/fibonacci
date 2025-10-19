from django.contrib import admin
from .models import Strategy, Trade

# Custom filter to show only winning or losing trades
class WinnerFilter(admin.SimpleListFilter):
    title = 'Win/Loss'  # display name in the admin sidebar
    parameter_name = 'winloss'

    def lookups(self, request, model_admin):
        return (
            ('yes', 'Winning trades'),
            ('no', 'Losing trades'),
        )

    def queryset(self, request, queryset):
        if self.value() == 'yes':
            return [t for t in queryset if t.is_winner]
        elif self.value() == 'no':
            return [t for t in queryset if not t.is_winner]
        return queryset
@admin.register(Strategy)
class StrategyAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'user', 'created_at')
    list_filter = ('user',)
    search_fields = ('name', 'description')
    ordering = ('-created_at',)


@admin.register(Trade)
class TradeAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'symbol', 'strategy', 'user',
        'entry_price', 'exit_price', 'pnl', 'pnl_percent',
        'trade_date', 'close_date', 'is_winner_display',
    )
    list_filter = ('user', 'strategy', 'symbol',)
    search_fields = ('symbol', 'tags', 'notes')
    readonly_fields = ('pnl', 'pnl_percent', 'created_at', 'updated_at')
    ordering = ('-trade_date',)

    def is_winner_display(self, obj):
        """Show whether the trade was profitable."""
        return obj.is_winner

    is_winner_display.short_description = 'Winner?'
    is_winner_display.boolean = True  