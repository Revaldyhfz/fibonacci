"""Binance provider tests with mocked HTTP."""
import pytest
import respx
from httpx import Response

from portfolio_service.providers import binance


def test_is_binance_symbol_true_for_stablecoin_pairs():
    assert binance.is_binance_symbol("BTCUSDT") is True
    assert binance.is_binance_symbol("ethbusd") is True
    assert binance.is_binance_symbol("SOLUSDC") is True


def test_is_binance_symbol_false_for_coingecko_ids():
    assert binance.is_binance_symbol("bitcoin") is False
    assert binance.is_binance_symbol("pump-fun") is False
    assert binance.is_binance_symbol("") is False


@respx.mock
async def test_get_price_parses_ticker_response():
    respx.get("https://api.binance.com/api/v3/ticker/24hr").mock(
        return_value=Response(200, json={
            "symbol": "BTCUSDT",
            "lastPrice": "74500.12",
            "priceChangePercent": "1.45",
            "quoteVolume": "900000000",
        })
    )
    result = await binance.get_price("BTCUSDT")
    assert result is not None
    assert result.price_usd == pytest.approx(74500.12)
    assert result.change_24h == pytest.approx(1.45)
    assert result.source == "binance"
    assert result.symbol == "BTCUSDT"


@respx.mock
async def test_get_price_returns_none_on_404():
    respx.get("https://api.binance.com/api/v3/ticker/24hr").mock(
        return_value=Response(404, json={"msg": "Invalid symbol"})
    )
    assert await binance.get_price("FAKECOIN") is None


@respx.mock
async def test_search_matches_base_asset():
    respx.get("https://api.binance.com/api/v3/exchangeInfo").mock(
        return_value=Response(200, json={
            "symbols": [
                {"symbol": "BTCUSDT", "baseAsset": "BTC", "quoteAsset": "USDT", "status": "TRADING"},
                {"symbol": "ETHUSDT", "baseAsset": "ETH", "quoteAsset": "USDT", "status": "TRADING"},
                {"symbol": "BTCBUSD", "baseAsset": "BTC", "quoteAsset": "BUSD", "status": "TRADING"},  # wrong quote
            ],
        })
    )
    results = await binance.search("BTC", limit=10)
    assert len(results) == 1  # only USDT pair
    assert results[0]["symbol"] == "BTC"
    assert results[0]["id"] == "BTCUSDT"
    assert results[0]["asset_type"] == "crypto"
