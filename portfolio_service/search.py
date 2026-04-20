"""Unified search — Binance crypto + Yahoo stocks in parallel."""
from __future__ import annotations

import asyncio
import logging
from typing import List

from .providers import binance, yahoo

logger = logging.getLogger(__name__)


async def search(query: str, limit: int = 20) -> List[dict]:
    """Search both crypto and stock universes concurrently and merge results.

    Crypto matches appear first (Binance has exact-symbol precedence, which
    matters for common tickers like BTC), then stocks by Yahoo relevance.
    """
    half = max(5, limit // 2)
    crypto_task = asyncio.create_task(binance.search(query, limit=half))
    stock_task = asyncio.create_task(yahoo.search(query, limit=half))

    crypto, stocks = await asyncio.gather(
        crypto_task, stock_task, return_exceptions=True
    )

    merged: List[dict] = []
    if isinstance(crypto, list):
        merged.extend(crypto)
    else:
        logger.warning("Crypto search failed: %s", crypto)

    if isinstance(stocks, list):
        merged.extend(stocks)
    else:
        logger.warning("Stock search failed: %s", stocks)

    return merged[:limit]
