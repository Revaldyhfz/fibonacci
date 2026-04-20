"""Yahoo provider tests — stock price + FX conversion + market inference."""
import pytest
import respx
from httpx import Response

from portfolio_service.providers import yahoo


def test_infer_market_us_has_no_suffix():
    assert yahoo.infer_market("AAPL") == "US"
    assert yahoo.infer_market("SPY") == "US"


def test_infer_market_idx_from_jk_suffix():
    assert yahoo.infer_market("BBCA.JK") == "ID"
    assert yahoo.infer_market("TLKM.JK") == "ID"


def test_infer_market_other_suffixes():
    assert yahoo.infer_market("7203.T") == "JP"      # Toyota on Tokyo
    assert yahoo.infer_market("HSBA.L") == "UK"
    assert yahoo.infer_market("0700.HK") == "HK"
    assert yahoo.infer_market("CBA.AX") == "AU"


def test_infer_market_unknown_suffix_returns_suffix():
    assert yahoo.infer_market("XYZ.ZZ") == "ZZ"


def _chart_payload(price, currency, prev_close):
    return {
        "chart": {
            "result": [{
                "meta": {
                    "regularMarketPrice": price,
                    "chartPreviousClose": prev_close,
                    "currency": currency,
                    "regularMarketVolume": 1000000,
                },
                "timestamp": [],
                "indicators": {"quote": [{"close": []}]},
            }]
        }
    }


@respx.mock
async def test_get_price_us_stock_no_fx():
    respx.get("https://query1.finance.yahoo.com/v8/finance/chart/AAPL").mock(
        return_value=Response(200, json=_chart_payload(270.0, "USD", 265.0))
    )
    result = await yahoo.get_price("AAPL")
    assert result is not None
    assert result.price_usd == 270.0
    assert result.native_price == 270.0
    assert result.currency == "USD"
    assert result.change_24h == pytest.approx(1.8867, rel=0.01)


@respx.mock
async def test_get_price_indonesian_stock_converts_idr_to_usd():
    # BBCA.JK chart: 6,550 IDR per share, previous close 6,500 IDR
    respx.get("https://query1.finance.yahoo.com/v8/finance/chart/BBCA.JK").mock(
        return_value=Response(200, json=_chart_payload(6550.0, "IDR", 6500.0))
    )
    # IDRUSD=X FX rate: 1 IDR = 0.0001 USD (i.e. ~10,000 IDR per USD)
    respx.get("https://query1.finance.yahoo.com/v8/finance/chart/IDRUSD=X").mock(
        return_value=Response(200, json={
            "chart": {"result": [{"meta": {"regularMarketPrice": 0.0001}}]}
        })
    )
    result = await yahoo.get_price("BBCA.JK")
    assert result is not None
    assert result.native_price == 6550.0
    assert result.currency == "IDR"
    # 6550 * 0.0001 = 0.655 USD per share
    assert result.price_usd == pytest.approx(0.655, rel=0.01)


@respx.mock
async def test_get_price_returns_none_when_result_missing():
    respx.get("https://query1.finance.yahoo.com/v8/finance/chart/GARBAGE").mock(
        return_value=Response(200, json={"chart": {"result": None}})
    )
    assert await yahoo.get_price("GARBAGE") is None


@respx.mock
async def test_search_filters_to_tradable_quote_types():
    respx.get("https://query1.finance.yahoo.com/v1/finance/search").mock(
        return_value=Response(200, json={
            "quotes": [
                {"symbol": "AAPL", "quoteType": "EQUITY", "shortname": "Apple Inc.", "longname": "Apple Inc."},
                {"symbol": "BBCA.JK", "quoteType": "EQUITY", "longname": "Bank Central Asia"},
                {"symbol": "SOME-FUTURE", "quoteType": "FUTURE", "shortname": "Not tradeable here"},
            ]
        })
    )
    results = await yahoo.search("apple", limit=10)
    symbols = [r["symbol"] for r in results]
    assert "AAPL" in symbols
    assert "BBCA" in symbols  # strips .JK for symbol display
    assert "SOME-FUTURE" not in symbols
    bbca = next(r for r in results if r["symbol"] == "BBCA")
    assert bbca["market"] == "ID"
