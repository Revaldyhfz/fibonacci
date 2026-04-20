"""Asset-type-aware dispatcher — picks the right provider per asset."""
from __future__ import annotations

import logging
from typing import List, Optional

from .models import Asset, PriceData
from .providers import binance, coingecko, yahoo

logger = logging.getLogger(__name__)


async def get_price(asset: Asset) -> Optional[PriceData]:
    """Return current USD price for an asset, or None if unavailable."""
    if asset.asset_type == "stock":
        return await yahoo.get_price(asset.coin_id or asset.symbol)

    # crypto (default)
    coin_id = asset.coin_id or asset.symbol
    if binance.is_binance_symbol(coin_id):
        price = await binance.get_price(coin_id)
        if price:
            return price
    return await coingecko.get_price(coin_id)


async def fetch_history(asset: Asset, days: int) -> Optional[List[List[float]]]:
    """Return [[ms_timestamp, usd_price], ...] for an asset."""
    if asset.asset_type == "stock":
        return await yahoo.fetch_history(asset.coin_id or asset.symbol, days)

    coin_id = asset.coin_id or asset.symbol
    if binance.is_binance_symbol(coin_id):
        prices = await binance.fetch_history(coin_id, days)
        if prices:
            return prices
    return await coingecko.fetch_history(coin_id, days)
