"""Unified search tests — merges Binance + Yahoo results."""
from unittest.mock import AsyncMock, patch

import pytest

from portfolio_service import search as search_svc


async def test_merges_crypto_and_stock_results():
    crypto_results = [
        {"id": "BTCUSDT", "symbol": "BTC", "name": "BTC/USDT", "asset_type": "crypto", "market": "crypto", "source": "binance"},
    ]
    stock_results = [
        {"id": "AAPL", "symbol": "AAPL", "name": "Apple Inc.", "asset_type": "stock", "market": "US", "source": "yahoo"},
        {"id": "BBCA.JK", "symbol": "BBCA", "name": "Bank Central Asia", "asset_type": "stock", "market": "ID", "source": "yahoo"},
    ]
    with patch("portfolio_service.search.binance.search", new=AsyncMock(return_value=crypto_results)), \
         patch("portfolio_service.search.yahoo.search", new=AsyncMock(return_value=stock_results)):
        results = await search_svc.search("B", limit=20)
    # Crypto first (as we listed), then stocks
    assert results[0]["asset_type"] == "crypto"
    assert len(results) == 3
    markets = {r["market"] for r in results}
    assert markets == {"crypto", "US", "ID"}


async def test_crypto_failure_still_returns_stocks():
    stock_results = [{"id": "AAPL", "symbol": "AAPL", "name": "Apple Inc.", "asset_type": "stock", "market": "US", "source": "yahoo"}]
    with patch("portfolio_service.search.binance.search", new=AsyncMock(side_effect=RuntimeError("Binance down"))), \
         patch("portfolio_service.search.yahoo.search", new=AsyncMock(return_value=stock_results)):
        results = await search_svc.search("AAPL", limit=10)
    assert len(results) == 1
    assert results[0]["symbol"] == "AAPL"


async def test_limit_is_respected():
    many_crypto = [{"id": f"X{i}USDT", "symbol": f"X{i}", "name": "x", "asset_type": "crypto", "market": "crypto", "source": "binance"} for i in range(30)]
    many_stocks = [{"id": f"S{i}", "symbol": f"S{i}", "name": "s", "asset_type": "stock", "market": "US", "source": "yahoo"} for i in range(30)]
    with patch("portfolio_service.search.binance.search", new=AsyncMock(return_value=many_crypto[:5])), \
         patch("portfolio_service.search.yahoo.search", new=AsyncMock(return_value=many_stocks[:5])):
        results = await search_svc.search("x", limit=10)
    assert len(results) == 10
