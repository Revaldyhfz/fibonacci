"""CoinGecko fallback — used when a coin isn't on Binance.

Free-tier rate limit is ~30 req/min, so we cache aggressively and sleep a
beat before each call to stay under the limit.
"""
from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

import httpx

from ..cache import TTLCache
from ..models import PriceData

logger = logging.getLogger(__name__)

COINGECKO_API = "https://api.coingecko.com/api/v3"
_RATE_LIMIT_DELAY = 1.5

_price_cache = TTLCache(ttl_seconds=300)
_history_cache = TTLCache(ttl_seconds=1800)


async def get_price(coin_id: str) -> Optional[PriceData]:
    coin_id = (coin_id or "").lower()
    if not coin_id:
        return None
    cached = _price_cache.get(coin_id)
    if cached is not None:
        return cached
    try:
        await asyncio.sleep(_RATE_LIMIT_DELAY)
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{COINGECKO_API}/simple/price",
                params={
                    "ids": coin_id,
                    "vs_currencies": "usd",
                    "include_24hr_change": "true",
                },
            )
            if resp.status_code != 200:
                return None
            payload = resp.json()
            if coin_id not in payload:
                return None
            coin_data = payload[coin_id]
            result = PriceData(
                price_usd=float(coin_data["usd"]),
                change_24h=float(coin_data.get("usd_24h_change") or 0),
                volume_24h=0.0,
                source="coingecko",
                symbol=coin_id,
                currency="USD",
                native_price=float(coin_data["usd"]),
            )
            _price_cache.set(coin_id, result)
            return result
    except Exception as exc:
        logger.warning("CoinGecko price error for %s: %s", coin_id, exc)
        return None


async def fetch_history(coin_id: str, days: int) -> Optional[List[List[float]]]:
    coin_id = (coin_id or "").lower()
    if not coin_id:
        return None
    cache_key = f"{coin_id}:{days}"
    cached = _history_cache.get(cache_key)
    if cached is not None:
        return cached
    try:
        await asyncio.sleep(2.0)
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{COINGECKO_API}/coins/{coin_id}/market_chart",
                params={
                    "vs_currency": "usd",
                    "days": str(days),
                    "interval": "hourly" if days <= 7 else "daily",
                },
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            prices = data.get("prices", [])
            _history_cache.set(cache_key, prices)
            return prices
    except Exception as exc:
        logger.warning("CoinGecko history error for %s: %s", coin_id, exc)
        return None
