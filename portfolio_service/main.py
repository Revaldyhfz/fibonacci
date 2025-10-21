# portfolio_service/main.py - FIXED VERSION
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import httpx
import asyncio
from collections import defaultdict

app = FastAPI(title="Crypto Portfolio Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Enhanced caching system
price_cache = {}
history_cache = {}
PRICE_CACHE_DURATION = 300  # 5 minutes
HISTORY_CACHE_DURATION = 3600  # 1 hour

# Rate limiting - CRITICAL for CoinGecko free tier
API_RATE_LIMIT = 0.5  # Wait 0.5 seconds between API calls (120 calls/min max)
last_api_call = datetime.now()

async def rate_limited_request(client: httpx.AsyncClient, url: str, params: dict):
    """Make rate-limited API request to avoid 429 errors"""
    global last_api_call
    
    # Wait if needed to respect rate limit
    time_since_last = (datetime.now() - last_api_call).total_seconds()
    if time_since_last < API_RATE_LIMIT:
        await asyncio.sleep(API_RATE_LIMIT - time_since_last)
    
    # Make request with retry logic
    max_retries = 3
    for attempt in range(max_retries):
        try:
            last_api_call = datetime.now()
            response = await client.get(url, params=params, timeout=15)
            
            if response.status_code == 429:
                # Rate limited - wait and retry
                wait_time = (attempt + 1) * 2  # Exponential backoff: 2s, 4s, 6s
                print(f"⚠️ Rate limited. Waiting {wait_time}s before retry {attempt + 1}/{max_retries}")
                await asyncio.sleep(wait_time)
                continue
            
            response.raise_for_status()
            return response
            
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 429 and attempt < max_retries - 1:
                continue
            raise
    
    raise HTTPException(status_code=429, detail="CoinGecko API rate limit exceeded. Please wait a moment.")

class Asset(BaseModel):
    symbol: str
    coin_id: str
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
        "message": "Crypto Portfolio Service (Rate Limited)",
        "rate_limit": "10-30 calls/minute (CoinGecko free tier)",
        "cache_duration": {
            "prices": f"{PRICE_CACHE_DURATION}s",
            "history": f"{HISTORY_CACHE_DURATION}s"
        }
    }

@app.get("/price/{coin_id}")
async def get_crypto_price(coin_id: str):
    """Get current price with caching to avoid rate limits"""
    coin_id = coin_id.lower()
    
    # Check cache first
    cache_key = f"price_{coin_id}"
    if cache_key in price_cache:
        cached_data = price_cache[cache_key]
        if (datetime.now() - cached_data['timestamp']).seconds < PRICE_CACHE_DURATION:
            print(f"✓ Using cached price for {coin_id}")
            return cached_data['data']
    
    # Fetch from CoinGecko with rate limiting
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
            
            print(f"🌐 Fetching price for {coin_id}...")
            response = await rate_limited_request(client, url, params)
            data = response.json()
            
            if coin_id not in data:
                raise HTTPException(404, f"Coin '{coin_id}' not found")
            
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
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(503, f"CoinGecko API error: {str(e)}")

@app.post("/portfolio/calculate")
async def calculate_portfolio(assets: List[Asset]):
    """Calculate portfolio with rate limiting"""
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
    
    print(f"📊 Calculating portfolio for {len(assets)} assets...")
    
    for i, asset in enumerate(assets):
        try:
            print(f"  [{i+1}/{len(assets)}] Processing {asset.symbol}...")
            price_data = await get_crypto_price(asset.coin_id)
            current_price = price_data['price_usd']
            current_value = asset.amount * current_price
            
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
            print(f"  ❌ Error for {asset.symbol}: {e.detail}")
            enriched_assets.append({
                'symbol': asset.symbol.upper(),
                'coin_id': asset.coin_id,
                'amount': asset.amount,
                'error': e.detail,
                'current_price': None,
                'current_value': None
            })
    
    total_pnl = total_value - total_cost if total_cost > 0 else 0
    total_pnl_percent = (total_pnl / total_cost * 100) if total_cost > 0 else 0
    
    print(f"✓ Portfolio calculated: ${total_value:.2f}")
    
    return PortfolioSummary(
        total_value_usd=round(total_value, 2),
        total_cost=round(total_cost, 2),
        total_pnl=round(total_pnl, 2),
        total_pnl_percent=round(total_pnl_percent, 2),
        assets=enriched_assets
    )

@app.post("/portfolio/history")
async def get_portfolio_history(assets: List[Asset], days: int = 7):
    """Get historical data with aggressive caching to avoid rate limits"""
    if not assets:
        return {'history': []}
    
    # Create cache key based on assets
    asset_ids = sorted([a.coin_id for a in assets])
    cache_key = f"history_{'-'.join(asset_ids)}_{days}"
    
    # Check cache (1 hour TTL for history)
    if cache_key in history_cache:
        cached_data = history_cache[cache_key]
        if (datetime.now() - cached_data['timestamp']).seconds < HISTORY_CACHE_DURATION:
            print(f"✓ Using cached history ({len(cached_data['data']['history'])} points)")
            return cached_data['data']
    
    print(f"📈 Fetching history for {len(assets)} assets over {days} days...")
    
    async with httpx.AsyncClient() as client:
        history_data = []
        
        for i, asset in enumerate(assets):
            try:
                print(f"  [{i+1}/{len(assets)}] Fetching {asset.symbol} history...")
                
                url = f"https://api.coingecko.com/api/v3/coins/{asset.coin_id}/market_chart"
                params = {
                    'vs_currency': 'usd',
                    'days': str(days),
                    'interval': 'hourly' if days <= 1 else 'daily'
                }
                
                response = await rate_limited_request(client, url, params)
                data = response.json()
                
                prices = data.get('prices', [])
                
                history_data.append({
                    'coin_id': asset.coin_id,
                    'symbol': asset.symbol,
                    'amount': asset.amount,
                    'prices': prices
                })
                
            except HTTPException as e:
                print(f"  ⚠️ Skipping {asset.coin_id}: {e.detail}")
                continue
            except Exception as e:
                print(f"  ❌ Error fetching {asset.coin_id}: {e}")
                continue
        
        if not history_data:
            return {'history': [], 'error': 'No historical data available'}
        
        # Aggregate portfolio value at each timestamp
        all_timestamps = set()
        for asset_history in history_data:
            for timestamp, _ in asset_history['prices']:
                all_timestamps.add(timestamp)
        
        sorted_timestamps = sorted(all_timestamps)
        
        # Calculate total portfolio value at each timestamp
        portfolio_history = []
        for timestamp in sorted_timestamps:
            total_value = 0
            
            for asset_history in history_data:
                closest_price = None
                min_diff = float('inf')
                
                for ts, price in asset_history['prices']:
                    diff = abs(ts - timestamp)
                    if diff < min_diff:
                        min_diff = diff
                        closest_price = price
                
                if closest_price:
                    total_value += closest_price * asset_history['amount']
            
            portfolio_history.append({
                'timestamp': timestamp,
                'date': datetime.fromtimestamp(timestamp / 1000).isoformat(),
                'value': round(total_value, 2)
            })
        
        result = {
            'history': portfolio_history,
            'days': days,
            'data_points': len(portfolio_history)
        }
        
        # Cache the result
        history_cache[cache_key] = {
            'data': result,
            'timestamp': datetime.now()
        }
        
        print(f"✓ History fetched: {len(portfolio_history)} data points")
        
        return result

@app.get("/search/{query}")
async def search_crypto(query: str, limit: int = 20):
    """Search with rate limiting"""
    if len(query) < 2:
        raise HTTPException(400, "Query must be at least 2 characters")
    
    async with httpx.AsyncClient() as client:
        try:
            url = "https://api.coingecko.com/api/v3/search"
            params = {'query': query}
            
            response = await rate_limited_request(client, url, params)
            data = response.json()
            
            coins = data.get('coins', [])[:limit]
            results = [
                {
                    'id': coin['id'],
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
            
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(503, f"Search failed: {str(e)}")

@app.get("/trending")
async def get_trending():
    """Get trending coins"""
    async with httpx.AsyncClient() as client:
        try:
            url = "https://api.coingecko.com/api/v3/search/trending"
            response = await rate_limited_request(client, url, {})
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
            raise HTTPException(503, f"Failed to fetch trending: {str(e)}")

# Clear old cache entries periodically
@app.on_event("startup")
async def startup_event():
    print("🚀 Portfolio Service started")
    print(f"⏱️ Rate limit: {API_RATE_LIMIT}s between calls")
    print(f"💾 Price cache: {PRICE_CACHE_DURATION}s")
    print(f"📊 History cache: {HISTORY_CACHE_DURATION}s")