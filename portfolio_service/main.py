# portfolio_service/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware  # ADD THIS
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import httpx

app = FastAPI(title="Crypto Portfolio Service")

# ADD CORS MIDDLEWARE
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Price cache (5 minute TTL)
price_cache = {}
CACHE_DURATION = 300  # 5 minutes

class Asset(BaseModel):
    symbol: str
    coin_id: str  # CoinGecko ID (e.g., "bitcoin", "ethereum")
    amount: float
    purchase_price: Optional[float] = None
    purchase_date: Optional[datetime] = None
    notes: Optional[str] = None

class PortfolioSummary(BaseModel):
    total_value_usd: float
    total_cost: float
    total_pnl: float
    total_pnl_percent: float
    assets: List[dict]

@app.get("/")
def root():
    return {
        "message": "Crypto Portfolio Service",
        "endpoints": {
            "search": "/search/{query} - Search for any cryptocurrency",
            "price": "/price/{coin_id} - Get live price for any coin",
            "portfolio": "/portfolio/calculate - Calculate portfolio value"
        }
    }

@app.get("/price/{coin_id}")
async def get_crypto_price(coin_id: str):
    """
    Get current price for ANY cryptocurrency using CoinGecko API
    coin_id examples: bitcoin, ethereum, solana, dogecoin, shiba-inu
    
    CoinGecko is FREE and supports 10,000+ cryptocurrencies
    """
    coin_id = coin_id.lower()
    
    # Check cache first
    cache_key = f"price_{coin_id}"
    if cache_key in price_cache:
        cached_data = price_cache[cache_key]
        if (datetime.now() - cached_data['timestamp']).seconds < CACHE_DURATION:
            return cached_data['data']
    
    # Fetch from CoinGecko
    async with httpx.AsyncClient() as client:
        try:
            url = "https://api.coingecko.com/api/v3/simple/price"
            params = {
                'ids': coin_id,
                'vs_currencies': 'usd',
                'include_24hr_change': 'true',
                'include_24hr_vol': 'true',
                'include_market_cap': 'true'
            }
            response = await client.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if coin_id not in data:
                raise HTTPException(
                    status_code=404, 
                    detail=f"Coin '{coin_id}' not found. Use /search endpoint to find the correct coin_id"
                )
            
            result = {
                'coin_id': coin_id,
                'price_usd': data[coin_id]['usd'],
                'change_24h': data[coin_id].get('usd_24h_change', 0),
                'volume_24h': data[coin_id].get('usd_24h_vol', 0),
                'market_cap': data[coin_id].get('usd_market_cap', 0),
                'timestamp': datetime.now().isoformat()
            }
            
            # Cache the result
            price_cache[cache_key] = {
                'data': result,
                'timestamp': datetime.now()
            }
            
            return result
            
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=503, 
                detail=f"CoinGecko API error: {str(e)}"
            )

@app.post("/portfolio/calculate")
async def calculate_portfolio(assets: List[Asset]):
    """
    Calculate portfolio value for ANY cryptocurrency
    No hardcoded symbols - works with all 10,000+ coins on CoinGecko
    """
    if not assets:
        return PortfolioSummary(
            total_value_usd=0,
            total_cost=0,
            total_pnl=0,
            total_pnl_percent=0,
            assets=[]
        )
    
    total_value = 0.0
    total_cost = 0.0
    enriched_assets = []
    
    for asset in assets:
        try:
            # Get current price using the stored coin_id
            price_data = await get_crypto_price(asset.coin_id)
            current_price = price_data['price_usd']
            current_value = asset.amount * current_price
            
            # Calculate P&L if purchase price provided
            if asset.purchase_price:
                cost = asset.amount * asset.purchase_price
                pnl = current_value - cost
                pnl_percent = (pnl / cost * 100) if cost > 0 else 0
                total_cost += cost
            else:
                cost = 0
                pnl = 0
                pnl_percent = 0
            
            total_value += current_value
            
            enriched_assets.append({
                'symbol': asset.symbol.upper(),
                'coin_id': asset.coin_id,
                'amount': asset.amount,
                'current_price': round(current_price, 2),
                'current_value': round(current_value, 2),
                'purchase_price': asset.purchase_price,
                'cost': round(cost, 2) if asset.purchase_price else None,
                'pnl': round(pnl, 2) if asset.purchase_price else None,
                'pnl_percent': round(pnl_percent, 2) if asset.purchase_price else None,
                'change_24h': round(price_data.get('change_24h', 0), 2),
                'volume_24h': price_data.get('volume_24h', 0),
                'market_cap': price_data.get('market_cap', 0),
                'notes': asset.notes
            })
            
        except HTTPException as e:
            # If price fetch fails, add asset with error
            enriched_assets.append({
                'symbol': asset.symbol.upper(),
                'coin_id': asset.coin_id,
                'amount': asset.amount,
                'error': e.detail,
                'current_price': None,
                'current_value': None
            })
        except Exception as e:
            enriched_assets.append({
                'symbol': asset.symbol.upper(),
                'coin_id': asset.coin_id,
                'amount': asset.amount,
                'error': f"Unexpected error: {str(e)}",
                'current_price': None,
                'current_value': None
            })
    
    total_pnl = total_value - total_cost if total_cost > 0 else 0
    total_pnl_percent = (total_pnl / total_cost * 100) if total_cost > 0 else 0
    
    return PortfolioSummary(
        total_value_usd=round(total_value, 2),
        total_cost=round(total_cost, 2),
        total_pnl=round(total_pnl, 2),
        total_pnl_percent=round(total_pnl_percent, 2),
        assets=enriched_assets
    )

@app.get("/search/{query}")
async def search_crypto(query: str, limit: int = 20):
    """
    Search for ANY cryptocurrency by name or symbol
    Examples: "bitcoin", "doge", "shiba", "pepe"
    
    Returns coin_id that can be used for price lookup
    """
    if len(query) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")
    
    async with httpx.AsyncClient() as client:
        try:
            url = "https://api.coingecko.com/api/v3/search"
            params = {'query': query}
            response = await client.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            # Return top results with all necessary info
            coins = data.get('coins', [])[:limit]
            results = [
                {
                    'id': coin['id'],  # This is the coin_id to store in DB
                    'symbol': coin['symbol'].upper(),
                    'name': coin['name'],
                    'thumb': coin.get('thumb', ''),
                    'large': coin.get('large', ''),
                    'market_cap_rank': coin.get('market_cap_rank')
                }
                for coin in coins
            ]
            
            return {
                'query': query,
                'count': len(results),
                'results': results
            }
            
        except httpx.HTTPError as e:
            raise HTTPException(
                status_code=503, 
                detail=f"CoinGecko search failed: {str(e)}"
            )

@app.get("/trending")
async def get_trending():
    """Get trending cryptocurrencies"""
    async with httpx.AsyncClient() as client:
        try:
            url = "https://api.coingecko.com/api/v3/search/trending"
            response = await client.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            trending_coins = [
                {
                    'id': coin['item']['id'],
                    'symbol': coin['item']['symbol'].upper(),
                    'name': coin['item']['name'],
                    'thumb': coin['item'].get('thumb', ''),
                    'market_cap_rank': coin['item'].get('market_cap_rank'),
                    'price_btc': coin['item'].get('price_btc')
                }
                for coin in data.get('coins', [])
            ]
            
            return {'trending': trending_coins}
            
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Failed to fetch trending: {str(e)}")