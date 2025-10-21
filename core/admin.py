from django.contrib import admin
from .models import Strategy, Trade

class WinnerFilter(admin.SimpleListFilter):
    title = 'Win/Loss'
    parameter_name = 'winloss'

    def lookups(self, request, model_admin):
        return (
            ('yes', 'Winning trades'),
            ('no', 'Losing trades'),
        )

    def queryset(self, request, queryset):
        if self.value() == 'yes':
            return queryset.filter(pnl__gt=0)
        elif self.value() == 'no':
            return queryset.filter(pnl__lte=0)
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
    list_filter = ('user', 'strategy', 'symbol', WinnerFilter)
    search_fields = ('symbol', 'tags', 'notes')
    readonly_fields = ('pnl', 'pnl_percent', 'created_at', 'updated_at')
    ordering = ('-trade_date',)

    def is_winner_display(self, obj):
        return obj.is_winner

    is_winner_display.short_description = 'Winner?'
    is_winner_display.boolean = True