from rest_framework import serializers
from .models import CryptoAsset, Strategy, Trade


class StrategySerializer(serializers.ModelSerializer):
    class Meta:
        model = Strategy
        fields = ['id', 'name', 'description', 'created_at']
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class TradeSerializer(serializers.ModelSerializer):
    is_winner = serializers.ReadOnlyField()

    class Meta:
        model = Trade
        fields = [
            'id', 'symbol', 'strategy', 'direction', 'entry_price', 'exit_price',
            'position_size', 'fees', 'pnl', 'pnl_percent',
            'trade_date', 'close_date', 'notes', 'tags', 'screenshot',
            'is_winner', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'pnl', 'pnl_percent', 'is_winner',
            'created_at', 'updated_at'
        ]

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)
    
class CryptoAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = CryptoAsset
        fields = ['id', 'symbol', 'coin_id', 'amount', 'purchase_price', 'purchase_date', 'notes', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)