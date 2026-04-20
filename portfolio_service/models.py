"""Pydantic models shared across the portfolio service."""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

AssetType = Literal["crypto", "stock"]

# Guards against bad client input. Pydantic raises 422 automatically, so the
# caller gets a structured error instead of a stale price or a poisoned row.
_MAX_POSITION = 1_000_000_000      # 1B units of anything — FTMO lot sizes stay well under this
_MAX_PRICE = 100_000_000           # $100M per unit covers every realistic asset
_MAX_SYMBOL_LEN = 24               # Yahoo tickers top out around 10 chars; keep headroom


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

    @field_validator("symbol")
    @classmethod
    def _validate_symbol(cls, v: str) -> str:
        v = (v or "").strip().upper()
        if not v:
            raise ValueError("symbol is required")
        if len(v) > _MAX_SYMBOL_LEN:
            raise ValueError(f"symbol too long (max {_MAX_SYMBOL_LEN} chars)")
        return v

    @field_validator("coin_id")
    @classmethod
    def _validate_coin_id(cls, v: str) -> str:
        v = (v or "").strip()
        if len(v) > 64:
            raise ValueError("coin_id too long (max 64 chars)")
        return v

    @field_validator("amount")
    @classmethod
    def _validate_amount(cls, v: float) -> float:
        if v is None or v <= 0:
            raise ValueError("amount must be greater than zero")
        if v > _MAX_POSITION:
            raise ValueError(f"amount unreasonably large (max {_MAX_POSITION})")
        return v

    @field_validator("purchase_price")
    @classmethod
    def _validate_purchase_price(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return None
        if v < 0:
            raise ValueError("purchase_price cannot be negative")
        if v > _MAX_PRICE:
            raise ValueError(f"purchase_price unreasonably large (max {_MAX_PRICE})")
        return v

    @field_validator("purchase_date")
    @classmethod
    def _validate_purchase_date(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is None:
            return None
        now = datetime.now(tz=v.tzinfo) if v.tzinfo else datetime.utcnow()
        if v > now:
            raise ValueError("purchase_date cannot be in the future")
        # Stock markets didn't exist before ~1600. Sanity guard.
        if v.year < 1900:
            raise ValueError("purchase_date looks wrong (year < 1900)")
        return v

    @field_validator("notes")
    @classmethod
    def _validate_notes(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        # Hard cap to prevent storage abuse; UI textarea is short-form.
        if len(v) > 2000:
            raise ValueError("notes too long (max 2000 chars)")
        return v


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
