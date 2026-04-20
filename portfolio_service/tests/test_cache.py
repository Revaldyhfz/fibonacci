"""TTLCache unit tests — verifies the .total_seconds() fix for long TTLs."""
import time
from datetime import datetime, timedelta
from unittest.mock import patch

from portfolio_service.cache import TTLCache


def test_set_and_get_within_ttl():
    cache = TTLCache(ttl_seconds=60)
    cache.set("btc", {"price": 100})
    assert cache.get("btc") == {"price": 100}


def test_miss_returns_none():
    cache = TTLCache(ttl_seconds=60)
    assert cache.get("missing") is None


def test_expired_entry_returns_none():
    cache = TTLCache(ttl_seconds=0.05)
    cache.set("btc", 1)
    time.sleep(0.1)
    assert cache.get("btc") is None


def test_long_ttl_survives_one_day_boundary():
    """Regression: the old code used `.seconds` which caps at <86400. A 1-day
    cache would expire silently after seconds-of-day elapsed, not after a
    full day. `.total_seconds()` handles timedeltas >1 day correctly."""
    cache = TTLCache(ttl_seconds=86400)  # 24h
    now = datetime.now()
    # Simulate an entry stored 23 hours ago — should still be valid.
    with patch("portfolio_service.cache.datetime") as mock_dt:
        mock_dt.now.return_value = now - timedelta(hours=23)
        cache.set("symbols", ["BTCUSDT"])
    # Reading "now" — 23h after set. Should be valid.
    assert cache.get("symbols") == ["BTCUSDT"]


def test_clear_empties_cache():
    cache = TTLCache(ttl_seconds=60)
    cache.set("a", 1)
    cache.set("b", 2)
    cache.clear()
    assert len(cache) == 0
    assert cache.get("a") is None


def test_overwrites_existing_key():
    cache = TTLCache(ttl_seconds=60)
    cache.set("k", "v1")
    cache.set("k", "v2")
    assert cache.get("k") == "v2"
