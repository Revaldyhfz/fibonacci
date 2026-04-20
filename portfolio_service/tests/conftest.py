"""Pytest configuration for portfolio_service tests.

asyncio_mode=auto (from pytest.ini) means async tests don't need a decorator.
We clear provider caches between tests so mocked responses can't bleed.
"""
import pytest

from portfolio_service.providers import binance, coingecko, yahoo


@pytest.fixture(autouse=True)
def _clear_caches():
    binance._price_cache.clear()
    binance._history_cache.clear()
    binance._symbols_cache.clear()
    coingecko._price_cache.clear()
    coingecko._history_cache.clear()
    yahoo._price_cache.clear()
    yahoo._history_cache.clear()
    yahoo._fx_cache.clear()
    yield
