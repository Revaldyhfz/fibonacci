"""Portfolio aggregation tests — math + purchase-date filtering."""
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from portfolio_service import portfolio as portfolio_svc
from portfolio_service.models import Asset, PriceData


def _price(usd, change=0.0):
    return PriceData(
        price_usd=usd, change_24h=change, volume_24h=0,
        source="test", symbol="X", currency="USD", native_price=usd,
    )


async def test_empty_portfolio_returns_zeros():
    summary = await portfolio_svc.calculate([])
    assert summary.total_value_usd == 0
    assert summary.total_cost == 0
    assert summary.assets == []


async def test_single_holding_value_and_pnl():
    assets = [Asset(symbol="BTC", coin_id="BTCUSDT", amount=0.5, purchase_price=50000)]
    with patch("portfolio_service.portfolio.get_price", new=AsyncMock(return_value=_price(80000))):
        summary = await portfolio_svc.calculate(assets)
    assert summary.total_value_usd == 40000.0  # 0.5 * 80000
    assert summary.total_cost == 25000.0       # 0.5 * 50000
    assert summary.total_pnl == 15000.0
    assert summary.total_pnl_percent == 60.0


async def test_mixed_crypto_and_stock_portfolio():
    assets = [
        Asset(symbol="BTC", coin_id="BTCUSDT", asset_type="crypto", amount=0.1, purchase_price=50000),
        Asset(symbol="AAPL", coin_id="AAPL", asset_type="stock", amount=10, purchase_price=200),
    ]
    async def mock_price(asset):
        return _price(80000) if asset.asset_type == "crypto" else _price(270)

    with patch("portfolio_service.portfolio.get_price", new=AsyncMock(side_effect=mock_price)):
        summary = await portfolio_svc.calculate(assets)

    # BTC: 0.1 * 80k = 8000, AAPL: 10 * 270 = 2700 → total 10700
    assert summary.total_value_usd == 10700.0
    # Cost: 0.1 * 50k + 10 * 200 = 5000 + 2000 = 7000
    assert summary.total_cost == 7000.0
    assert summary.total_pnl == 3700.0
    # Both asset_types propagate into the enriched rows
    types = {a["asset_type"] for a in summary.assets}
    assert types == {"crypto", "stock"}


async def test_missing_price_preserves_other_assets():
    assets = [
        Asset(symbol="GOOD", coin_id="GOODUSDT", amount=1, purchase_price=100),
        Asset(symbol="BROKEN", coin_id="BROKENUSDT", amount=1, purchase_price=100),
    ]
    async def mock_price(asset):
        return _price(150) if asset.symbol == "GOOD" else None

    with patch("portfolio_service.portfolio.get_price", new=AsyncMock(side_effect=mock_price)):
        summary = await portfolio_svc.calculate(assets)

    # Only GOOD contributes to the total; BROKEN shows an error row
    assert summary.total_value_usd == 150.0
    broken_row = next(a for a in summary.assets if a["symbol"] == "BROKEN")
    assert broken_row["error"] is not None
    assert broken_row["current_value"] is None


async def test_no_purchase_price_means_no_pnl_contribution():
    assets = [Asset(symbol="BTC", coin_id="BTCUSDT", amount=1)]  # no purchase_price
    with patch("portfolio_service.portfolio.get_price", new=AsyncMock(return_value=_price(80000))):
        summary = await portfolio_svc.calculate(assets)
    # Value is known, but cost is 0 → pnl is 0 (no basis to compute against)
    assert summary.total_value_usd == 80000.0
    assert summary.total_cost == 0
    assert summary.total_pnl == 0


async def test_history_excludes_asset_before_purchase_date():
    """Regression: a BTC held starting day 5 shouldn't appear in the portfolio
    value on day 1. Previous naive aggregation would backdate the holding."""
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    day = lambda n: int((base + timedelta(days=n)).timestamp() * 1000)

    asset = Asset(
        symbol="BTC",
        coin_id="BTCUSDT",
        amount=1,
        purchase_date=base + timedelta(days=5),
    )

    # 10 days of prices, $100 each day
    mock_prices = [[day(n), 100.0] for n in range(10)]

    with patch("portfolio_service.portfolio.fetch_history",
               new=AsyncMock(return_value=mock_prices)):
        result = await portfolio_svc.history([asset], days=10)

    values_before_purchase = [p for p in result["history"] if p["timestamp"] < day(5)]
    values_after_purchase = [p for p in result["history"] if p["timestamp"] >= day(5)]

    assert values_before_purchase == []  # asset wasn't held yet
    assert len(values_after_purchase) == 5  # days 5–9
    assert all(p["value"] == 100.0 for p in values_after_purchase)
