"""Yahoo Finance chart/search client — covers stocks across all markets.

Indonesian stocks use the `.JK` suffix (e.g. `BBCA.JK`), Tokyo uses `.T`,
London `.L`, etc. US tickers have no suffix. FX conversion to USD is done
transparently using Yahoo's own FX pairs (e.g. `IDRUSD=X`) so the portfolio
can mix IDX + US + crypto safely.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Dict, List, Optional

import httpx

from ..cache import TTLCache
from ..models import PriceData

logger = logging.getLogger(__name__)

YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart"
YAHOO_SEARCH = "https://query1.finance.yahoo.com/v1/finance/search"

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
_HEADERS = {"User-Agent": _UA, "Accept": "application/json"}

_price_cache = TTLCache(ttl_seconds=60)
_history_cache = TTLCache(ttl_seconds=1800)
_fx_cache = TTLCache(ttl_seconds=3600)


_MARKET_SUFFIX_MAP: Dict[str, str] = {
    "JK": "ID",   # Jakarta (Indonesia)
    "T":  "JP",   # Tokyo
    "L":  "UK",   # London
    "HK": "HK",
    "AX": "AU",   # Sydney
    "SI": "SG",
    "KS": "KR",   # KRX Seoul
    "SS": "CN",   # Shanghai
    "SZ": "CN",   # Shenzhen
    "TO": "CA",   # Toronto
    "PA": "FR",
    "DE": "DE",
    "MI": "IT",
    "MC": "ES",
    "SW": "CH",
    "AS": "NL",
    "BR": "BE",
    "ST": "SE",
    "BO": "IN",   # Bombay
    "NS": "IN",   # NSE
    "BK": "TH",   # Thailand
    "KL": "MY",   # Malaysia
    "TW": "TW",
}


def infer_market(symbol: str) -> str:
    """Map a Yahoo ticker suffix to a two-letter market code (US if no suffix)."""
    if "." in symbol:
        suffix = symbol.rsplit(".", 1)[-1].upper()
        return _MARKET_SUFFIX_MAP.get(suffix, suffix)
    return "US"


async def _fx_to_usd(currency: str) -> float:
    """Return the FX multiplier from `currency` to USD (cached 1h)."""
    currency = (currency or "USD").upper()
    if currency == "USD":
        return 1.0
    cached = _fx_cache.get(currency)
    if cached is not None:
        return cached
    fx_ticker = f"{currency}USD=X"
    try:
        async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
            resp = await client.get(
                f"{YAHOO_CHART}/{fx_ticker}",
                params={"interval": "1d", "range": "5d"},
            )
            if resp.status_code != 200:
                logger.warning("Yahoo FX fetch non-200 for %s: %s", fx_ticker, resp.status_code)
                return 1.0
            result = resp.json()["chart"]["result"]
            if not result:
                return 1.0
            meta = result[0].get("meta") or {}
            rate = meta.get("regularMarketPrice")
            if not rate:
                return 1.0
            rate = float(rate)
            _fx_cache.set(currency, rate)
            return rate
    except Exception as exc:
        logger.warning("Yahoo FX error for %s: %s", currency, exc)
        return 1.0


async def get_price(ticker: str) -> Optional[PriceData]:
    ticker = (ticker or "").upper().strip()
    if not ticker:
        return None
    cached = _price_cache.get(ticker)
    if cached is not None:
        return cached
    try:
        async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
            resp = await client.get(
                f"{YAHOO_CHART}/{ticker}",
                params={"interval": "1m", "range": "1d"},
            )
            if resp.status_code != 200:
                logger.warning("Yahoo chart non-200 for %s: %s", ticker, resp.status_code)
                return None
            payload = resp.json()
            result_list = payload.get("chart", {}).get("result") or []
            if not result_list:
                return None
            meta = result_list[0].get("meta") or {}
            native_price = meta.get("regularMarketPrice")
            if native_price is None:
                return None
            native_price = float(native_price)
            prev_close = float(
                meta.get("chartPreviousClose")
                or meta.get("previousClose")
                or native_price
            )
            change_pct = (
                ((native_price - prev_close) / prev_close * 100.0)
                if prev_close
                else 0.0
            )
            currency = (meta.get("currency") or "USD").upper()
            fx = await _fx_to_usd(currency)
            usd_price = native_price * fx
            result = PriceData(
                price_usd=round(usd_price, 6),
                change_24h=round(change_pct, 4),
                volume_24h=float(meta.get("regularMarketVolume") or 0),
                source="yahoo",
                symbol=ticker,
                currency=currency,
                native_price=native_price,
            )
            _price_cache.set(ticker, result)
            return result
    except Exception as exc:
        logger.warning("Yahoo price error for %s: %s", ticker, exc)
        return None


async def fetch_history(ticker: str, days: int) -> Optional[List[List[float]]]:
    ticker = (ticker or "").upper().strip()
    if not ticker:
        return None
    cache_key = f"{ticker}:{days}"
    cached = _history_cache.get(cache_key)
    if cached is not None:
        return cached

    if days <= 1:
        yf_range, interval = "1d", "5m"
    elif days <= 5:
        yf_range, interval = "5d", "30m"
    elif days <= 30:
        yf_range, interval = "1mo", "1d"
    elif days <= 90:
        yf_range, interval = "3mo", "1d"
    elif days <= 180:
        yf_range, interval = "6mo", "1d"
    elif days <= 365:
        yf_range, interval = "1y", "1d"
    else:
        yf_range, interval = "2y", "1wk"

    try:
        async with httpx.AsyncClient(timeout=15, headers=_HEADERS) as client:
            resp = await client.get(
                f"{YAHOO_CHART}/{ticker}",
                params={"interval": interval, "range": yf_range},
            )
            if resp.status_code != 200:
                return None
            payload = resp.json()
            result_list = payload.get("chart", {}).get("result") or []
            if not result_list:
                return None
            result = result_list[0]
            timestamps = result.get("timestamp") or []
            quote = (result.get("indicators", {}).get("quote") or [{}])[0]
            closes = quote.get("close") or []
            currency = (result.get("meta", {}).get("currency") or "USD").upper()
            fx = await _fx_to_usd(currency)
            prices = [
                [int(ts) * 1000, float(close) * fx]
                for ts, close in zip(timestamps, closes)
                if close is not None
            ]
            _history_cache.set(cache_key, prices)
            return prices
    except Exception as exc:
        logger.warning("Yahoo history error for %s: %s", ticker, exc)
        return None


async def search(query: str, limit: int = 10) -> List[dict]:
    q = (query or "").strip()
    if not q:
        return []
    try:
        async with httpx.AsyncClient(timeout=10, headers=_HEADERS) as client:
            resp = await client.get(
                YAHOO_SEARCH,
                params={"q": q, "quotesCount": limit, "newsCount": 0, "enableFuzzyQuery": "true"},
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            quotes = data.get("quotes", []) or []
            out: List[dict] = []
            for quote in quotes:
                quote_type = (quote.get("quoteType") or "").upper()
                if quote_type not in ("EQUITY", "ETF", "MUTUALFUND", "INDEX"):
                    continue
                symbol = quote.get("symbol") or ""
                name = (
                    quote.get("longname")
                    or quote.get("shortname")
                    or quote.get("name")
                    or symbol
                )
                out.append({
                    "id": symbol,
                    "symbol": symbol.split(".")[0].upper() if "." in symbol else symbol,
                    "name": name,
                    "asset_type": "stock",
                    "market": infer_market(symbol),
                    "exchange": quote.get("exchange"),
                    "source": "yahoo",
                })
                if len(out) >= limit:
                    break
            return out
    except Exception as exc:
        logger.warning("Yahoo search error for %s: %s", q, exc)
        return []
