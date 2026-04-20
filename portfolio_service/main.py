"""FastAPI entrypoint for the Fibonacci portfolio service.

Responsibilities: HTTP surface only. Pricing, aggregation, and search live
in sibling modules. Supports crypto (Binance/CoinGecko) and stocks across
global markets (Yahoo Finance — US, IDX, Tokyo, London, etc.) with
transparent USD conversion.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from . import portfolio as portfolio_svc
from . import search as search_svc
from .models import Asset, PortfolioSummary
from .pricing import get_price
from .providers import binance

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("portfolio_service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Portfolio service starting — crypto (Binance/CoinGecko) + stocks (Yahoo, global)")
    yield
    logger.info("Portfolio service shutting down")


app = FastAPI(
    title="Fibonacci Portfolio Service",
    description="Unified portfolio valuation across crypto and global stocks.",
    version="2.0.0",
    lifespan=lifespan,
)

_allowed_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {
        "service": "portfolio-service",
        "version": "2.0.0",
        "providers": ["binance", "coingecko", "yahoo"],
        "asset_types": ["crypto", "stock"],
    }


@app.get("/health")
def health():
    return {"status": "healthy", "service": "portfolio-service"}


@app.get("/ready")
def ready():
    return {"status": "ready"}


@app.get("/live")
def live():
    return {"status": "alive", "service": "portfolio-service"}


@app.get("/price/{coin_id}")
async def price_endpoint(coin_id: str, asset_type: str = "crypto"):
    """Return current USD price for a coin or stock ticker."""
    asset = Asset(
        symbol=coin_id.upper(),
        coin_id=coin_id,
        asset_type="stock" if asset_type == "stock" else "crypto",
        amount=1,
    )
    price = await get_price(asset)
    if price is None:
        raise HTTPException(404, f"Price unavailable for {coin_id}")
    return price.model_dump()


@app.post("/portfolio/calculate", response_model=PortfolioSummary)
async def calculate_portfolio(assets: List[Asset]):
    return await portfolio_svc.calculate(assets)


@app.post("/portfolio/history")
async def portfolio_history(assets: List[Asset], days: int = Query(7, ge=1, le=1095)):
    return await portfolio_svc.history(assets, days)


@app.get("/search/{query}")
async def search_endpoint(query: str, limit: int = Query(20, ge=1, le=50)):
    """Unified search across crypto + stocks."""
    if not query or len(query.strip()) < 1:
        raise HTTPException(400, "Query too short")
    results = await search_svc.search(query.strip(), limit=limit)
    return {"query": query, "count": len(results), "results": results}


@app.get("/binance/symbols")
async def binance_symbols():
    symbols = await binance.get_symbols()
    return {"count": len(symbols), "symbols": symbols}
