"""Best-effort asset logo URL resolver.

Crypto:  CoinCap symbol-indexed CDN (public, no auth, good free coverage).
Stocks:  no stable free source across the US + IDX + LSE + TSE universe
         without per-exchange mappings, so we return ``None`` and the
         frontend renders a colored-initials fallback.

Callers must treat the returned URL as best-effort: it may 404 on long-tail
symbols. The frontend handles that via ``<img onError>``.
"""
from __future__ import annotations

from typing import Optional

from .cache import TTLCache

# Strip common quote suffixes so BTCUSDT → BTC for the icon lookup. Order
# matters: longest first so "USDT" beats "USD" on pairs like "BTCUSDT".
_CRYPTO_QUOTE_SUFFIXES = ("USDT", "USDC", "BUSD", "FDUSD", "TUSD", "USD")
_COINCAP_ICON_URL = "https://assets.coincap.io/assets/icons/{symbol}@2x.png"

# 24h TTL is fine — CDN URLs are stable. We also cache the empty-string
# sentinel so repeated lookups for unresolved stocks don't burn work.
_cache = TTLCache(ttl_seconds=86400)


def _crypto_base(symbol: str) -> str:
    sym = symbol.upper()
    for suffix in _CRYPTO_QUOTE_SUFFIXES:
        if sym.endswith(suffix) and len(sym) > len(suffix):
            return sym[: -len(suffix)]
    return sym


def resolve(symbol: str, asset_type: str, market: Optional[str] = None) -> Optional[str]:
    """Return a best-effort logo URL, or ``None`` to trigger the initials fallback."""
    if not symbol:
        return None
    key = f"{asset_type}:{symbol.upper()}"
    cached = _cache.get(key)
    if cached is not None:
        return cached or None

    url: Optional[str] = None
    if asset_type == "crypto":
        url = _COINCAP_ICON_URL.format(symbol=_crypto_base(symbol).lower())

    _cache.set(key, url or "")
    return url
