"""Pydantic models shared across the portfolio service."""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

AssetType = Literal["crypto", "stock"]


class Asset(BaseModel):
    """An asset holding — crypto coin or stock share."""

    symbol: str
    coin_id: str = ""  # Binance pair (BTCUSDT), CoinGecko id, or Yahoo ticker (AAPL, BBCA.JK)
    asset_type: AssetType = "crypto"
    market: Optional[str] = None  # 'US', 'ID', 'JP', 'crypto', etc. — informational
    amount: float
    purchase_price: Optional[float] = None  # always in USD
    purchase_date: Optional[datetime] = None
    notes: Optional[str] = None


class PriceData(BaseModel):
    price_usd: float
    change_24h: float = 0.0
    volume_24h: float = 0.0
    source: str
    symbol: str
    currency: str = "USD"  # native currency before USD conversion
    native_price: Optional[float] = None
    logo_url: Optional[str] = None


class PortfolioSummary(BaseModel):
    total_value_usd: float
    total_cost: float
    total_pnl: float
    total_pnl_percent: float
    assets: List[dict] = Field(default_factory=list)


class SearchResult(BaseModel):
    id: str  # canonical identifier: Binance pair or Yahoo ticker
    symbol: str
    name: str
    asset_type: AssetType
    market: Optional[str] = None
    exchange: Optional[str] = None
    source: str
    logo_url: Optional[str] = None
