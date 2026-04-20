"""Binance public API client — crypto prices, history, and trading pairs.

Rate limit: 1200 req/min (very generous). No key required.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import List, Optional

import httpx

from ..cache import TTLCache
from ..models import PriceData

logger = logging.getLogger(__name__)

BINANCE_API = "https://api.binance.com/api/v3"

_price_cache = TTLCache(ttl_seconds=60)
_history_cache = TTLCache(ttl_seconds=1800)
_symbols_cache = TTLCache(ttl_seconds=86400)


def is_binance_symbol(coin_id: str) -> bool:
    """Heuristic: Binance pairs end in a stablecoin quote (USDT/BUSD/USDC)."""
    c = (coin_id or "").upper()
    return c.endswith("USDT") or c.endswith("BUSD") or c.endswith("USDC")


async def get_price(symbol: str) -> Optional[PriceData]:
    symbol = symbol.upper()
    cached = _price_cache.get(symbol)
    if cached is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{BINANCE_API}/ticker/24hr", params={"symbol": symbol})
            if resp.status_code != 200:
                return None
            data = resp.json()
            result = PriceData(
                price_usd=float(data["lastPrice"]),
                change_24h=float(data["priceChangePercent"]),
                volume_24h=float(data.get("quoteVolume", 0) or 0),
                source="binance",
                symbol=symbol,
                currency="USD",
                native_price=float(data["lastPrice"]),
            )
            _price_cache.set(symbol, result)
            return result
    except Exception as exc:
        logger.warning("Binance price error for %s: %s", symbol, exc)
        return None


async def fetch_history(symbol: str, days: int) -> Optional[List[List[float]]]:
    cache_key = f"{symbol.upper()}:{days}"
    cached = _history_cache.get(cache_key)
    if cached is not None:
        return cached

    if days <= 1:
        interval = "15m"
    elif days <= 7:
        interval = "1h"
    elif days <= 30:
        interval = "4h"
    else:
        interval = "1d"

    end_ms = int(datetime.now().timestamp() * 1000)
    start_ms = int((datetime.now() - timedelta(days=days)).timestamp() * 1000)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{BINANCE_API}/klines",
                params={
                    "symbol": symbol.upper(),
                    "interval": interval,
                    "startTime": start_ms,
                    "endTime": end_ms,
                    "limit": 1000,
                },
            )
            if resp.status_code != 200:
                return None
            klines = resp.json()
            prices = [[int(k[0]), float(k[4])] for k in klines]
            _history_cache.set(cache_key, prices)
            return prices
    except Exception as exc:
        logger.warning("Binance history error for %s: %s", symbol, exc)
        return None


async def get_symbols() -> List[dict]:
    """Return live USDT trading pairs (24h cache)."""
    cached = _symbols_cache.get("symbols")
    if cached is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{BINANCE_API}/exchangeInfo")
            data = resp.json()
            result = [
                {
                    "symbol": s["symbol"],
                    "base_asset": s["baseAsset"],
                    "quote_asset": s["quoteAsset"],
                }
                for s in data.get("symbols", [])
                if s.get("quoteAsset") == "USDT" and s.get("status") == "TRADING"
            ]
            _symbols_cache.set("symbols", result)
            return result
    except Exception as exc:
        logger.warning("Binance exchangeInfo error: %s", exc)
        return []


async def search(query: str, limit: int = 10) -> List[dict]:
    """Search Binance trading pairs by substring match on base asset or full symbol."""
    q = (query or "").upper()
    if not q:
        return []
    symbols = await get_symbols()
    matches = [
        s for s in symbols
        if q in s["base_asset"] or q in s["symbol"]
    ][:limit]
    return [
        {
            "id": m["symbol"],
            "symbol": m["base_asset"],
            "name": f"{m['base_asset']}/USDT",
            "asset_type": "crypto",
            "market": "crypto",
            "exchange": "Binance",
            "source": "binance",
        }
        for m in matches
    ]
