"""Pricing dispatcher tests — routes assets to the right provider."""
from unittest.mock import AsyncMock, patch

import pytest

from portfolio_service import pricing
from portfolio_service.models import Asset, PriceData


def _price(symbol, source="binance", usd=100.0):
    return PriceData(
        price_usd=usd, change_24h=1.0, volume_24h=0, source=source,
        symbol=symbol, currency="USD", native_price=usd,
    )


async def test_stock_asset_routes_to_yahoo():
    asset = Asset(symbol="AAPL", coin_id="AAPL", asset_type="stock", amount=10)
    with patch("portfolio_service.pricing.yahoo.get_price", new=AsyncMock(return_value=_price("AAPL", "yahoo", 270.0))) as yh, \
         patch("portfolio_service.pricing.binance.get_price", new=AsyncMock()) as bn:
        result = await pricing.get_price(asset)
        yh.assert_awaited_once_with("AAPL")
        bn.assert_not_awaited()
    assert result.source == "yahoo"


async def test_crypto_usdt_pair_routes_to_binance_first():
    asset = Asset(symbol="BTC", coin_id="BTCUSDT", asset_type="crypto", amount=1)
    with patch("portfolio_service.pricing.binance.get_price", new=AsyncMock(return_value=_price("BTCUSDT", "binance", 75000.0))) as bn, \
         patch("portfolio_service.pricing.coingecko.get_price", new=AsyncMock()) as cg:
        result = await pricing.get_price(asset)
        bn.assert_awaited_once()
        cg.assert_not_awaited()
    assert result.source == "binance"


async def test_crypto_non_usdt_falls_back_to_coingecko():
    asset = Asset(symbol="PUMP", coin_id="pump-fun", asset_type="crypto", amount=100)
    with patch("portfolio_service.pricing.binance.get_price", new=AsyncMock(return_value=None)) as bn, \
         patch("portfolio_service.pricing.coingecko.get_price", new=AsyncMock(return_value=_price("pump-fun", "coingecko", 0.5))) as cg:
        result = await pricing.get_price(asset)
        # Binance shouldn't even be tried since the id doesn't match USDT heuristic.
        bn.assert_not_awaited()
        cg.assert_awaited_once_with("pump-fun")
    assert result.source == "coingecko"


async def test_binance_miss_falls_through_to_coingecko():
    """If the symbol looks like Binance but the fetch returns None (new listing,
    delisted, Binance down), we should fall back to CoinGecko by `coin_id`."""
    asset = Asset(symbol="LINK", coin_id="LINKUSDT", asset_type="crypto", amount=1)
    with patch("portfolio_service.pricing.binance.get_price", new=AsyncMock(return_value=None)) as bn, \
         patch("portfolio_service.pricing.coingecko.get_price", new=AsyncMock(return_value=_price("linkusdt", "coingecko", 15.0))) as cg:
        result = await pricing.get_price(asset)
        bn.assert_awaited_once()
        cg.assert_awaited_once()
    assert result.source == "coingecko"
