"""Portfolio aggregation logic — current value + historical reconstruction."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional

from . import logos
from .models import Asset, PortfolioSummary
from .pricing import fetch_history, get_price

logger = logging.getLogger(__name__)


async def calculate(assets: List[Asset]) -> PortfolioSummary:
    """Compute the current USD value + P&L for a list of holdings."""
    if not assets:
        return PortfolioSummary(
            total_value_usd=0, total_cost=0, total_pnl=0,
            total_pnl_percent=0, assets=[],
        )

    price_results = await asyncio.gather(
        *(get_price(asset) for asset in assets),
        return_exceptions=True,
    )

    total_value = 0.0
    total_cost = 0.0
    enriched: List[dict] = []

    for asset, price in zip(assets, price_results):
        logo_url = logos.resolve(asset.symbol, asset.asset_type, asset.market)

        if isinstance(price, Exception) or price is None:
            enriched.append({
                "symbol": asset.symbol.upper(),
                "coin_id": asset.coin_id,
                "asset_type": asset.asset_type,
                "market": asset.market,
                "amount": asset.amount,
                "logo_url": logo_url,
                "error": "Price unavailable",
                "current_price": None,
                "current_value": None,
            })
            continue

        current_price = price.price_usd
        current_value = asset.amount * current_price
        total_value += current_value

        if asset.purchase_price:
            cost = asset.amount * asset.purchase_price
            pnl = current_value - cost
            pnl_percent = (pnl / cost * 100) if cost > 0 else 0.0
            total_cost += cost
        else:
            cost = pnl = pnl_percent = 0.0

        enriched.append({
            "symbol": asset.symbol.upper(),
            "coin_id": asset.coin_id,
            "asset_type": asset.asset_type,
            "market": asset.market,
            "amount": asset.amount,
            "logo_url": logo_url,
            "current_price": round(current_price, 6),
            "current_value": round(current_value, 2),
            "purchase_price": asset.purchase_price,
            "cost": round(cost, 2) if asset.purchase_price else None,
            "pnl": round(pnl, 2) if asset.purchase_price else None,
            "pnl_percent": round(pnl_percent, 2) if asset.purchase_price else None,
            "change_24h": round(price.change_24h, 2),
            "source": price.source,
            "currency": price.currency,
            "native_price": price.native_price,
            "notes": asset.notes,
        })

    total_pnl = total_value - total_cost if total_cost > 0 else 0.0
    total_pnl_percent = (total_pnl / total_cost * 100) if total_cost > 0 else 0.0

    return PortfolioSummary(
        total_value_usd=round(total_value, 2),
        total_cost=round(total_cost, 2),
        total_pnl=round(total_pnl, 2),
        total_pnl_percent=round(total_pnl_percent, 2),
        assets=enriched,
    )


async def history(assets: List[Asset], days: int) -> dict:
    """Build a time-series of portfolio value with purchase-date awareness.

    Assets are excluded from a timestamp's sum if their purchase_date is later
    than that timestamp — so the chart reflects when each holding was actually
    acquired, not "assume you've held it the whole period".
    """
    if not assets:
        return {"history": [], "message": "No assets provided"}

    results = await asyncio.gather(
        *(fetch_history(asset, days) for asset in assets),
    )

    # Build per-asset history with purchase times
    asset_series = []
    assets_without_dates: List[str] = []

    for asset, prices in zip(assets, results):
        if not prices:
            continue
        if asset.purchase_date:
            purchase_ts = int(asset.purchase_date.timestamp() * 1000)
        else:
            purchase_ts = 0
            assets_without_dates.append(asset.symbol)
        asset_series.append({
            "id": f"{asset.symbol}:{asset.coin_id}",
            "symbol": asset.symbol,
            "amount": asset.amount,
            "purchase_ts": purchase_ts,
            "prices": sorted(prices, key=lambda p: p[0]),
        })

    if not asset_series:
        return {"history": [], "error": "No historical data available", "days": days}

    # Union of all timestamps across all assets
    all_timestamps = sorted({int(p[0]) for s in asset_series for p in s["prices"]})
    if not all_timestamps:
        return {"history": [], "error": "No price points", "days": days}

    iterators = {s["id"]: iter(s["prices"]) for s in asset_series}
    current: Dict[str, Optional[List]] = {
        s["id"]: next(iterators[s["id"]], None) for s in asset_series
    }
    latest_prices: Dict[str, Optional[float]] = {s["id"]: None for s in asset_series}

    portfolio_history: List[dict] = []
    for ts in all_timestamps:
        total_value = 0.0
        for s in asset_series:
            aid = s["id"]
            # Forward-fill to the latest known price at this timestamp
            while current[aid] and current[aid][0] <= ts:
                latest_prices[aid] = current[aid][1]
                current[aid] = next(iterators[aid], None)
            if ts < s["purchase_ts"]:
                continue
            if latest_prices[aid] is not None:
                total_value += latest_prices[aid] * s["amount"]
        if total_value > 0.01:
            portfolio_history.append({
                "timestamp": ts,
                "date": datetime.fromtimestamp(ts / 1000).isoformat(),
                "value": round(total_value, 2),
            })

    return {
        "history": portfolio_history,
        "days": days,
        "data_points": len(portfolio_history),
        "assets_without_purchase_date": assets_without_dates,
    }
