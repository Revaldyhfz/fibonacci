# portfolio_service/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import httpx

app = FastAPI(title="Crypto Portfolio Service")

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
        "message": "Crypto Portfolio Service",
        "endpoints": {
            "search": "/search/{query} - Search for any cryptocurrency",
            "price": "/price/{coin_id} - Get live price for any coin",
            "portfolio": "/portfolio/calculate - Calculate portfolio value",
            "history": "/portfolio/history - Get portfolio value history"
        }
    }

@app.get("/price/{coin_id}")
async def get_crypto_price(coin_id: str):
    """Get current price for ANY cryptocurrency using CoinGecko API"""
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
    """Calculate portfolio value for ANY cryptocurrency"""
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

@app.post("/portfolio/history")
async def get_portfolio_history(assets: List[Asset], days: int = 7):
    """
    Get historical portfolio value over the last N days
    Returns data points for charting
    """
    if not assets:
        return {'history': []}
    
    # Get historical data for each asset
    async with httpx.AsyncClient() as client:
        history_data = []
        
        for asset in assets:
            try:
                # CoinGecko market chart endpoint (last N days)
                url = f"https://api.coingecko.com/api/v3/coins/{asset.coin_id}/market_chart"
                params = {
                    'vs_currency': 'usd',
                    'days': str(days),
                    'interval': 'hourly' if days <= 1 else 'daily'
                }
                
                response = await client.get(url, params=params, timeout=15)
                response.raise_for_status()
                data = response.json()
                
                # data['prices'] is array of [timestamp_ms, price]
                prices = data.get('prices', [])
                
                history_data.append({
                    'coin_id': asset.coin_id,
                    'symbol': asset.symbol,
                    'amount': asset.amount,
                    'prices': prices
                })
                
            except Exception as e:
                print(f"Error fetching history for {asset.coin_id}: {e}")
                continue
        
        # Aggregate portfolio value at each timestamp
        if not history_data:
            return {'history': []}
        
        # Get all unique timestamps
        all_timestamps = set()
        for asset_history in history_data:
            for timestamp, _ in asset_history['prices']:
                all_timestamps.add(timestamp)
        
        # Sort timestamps
        sorted_timestamps = sorted(all_timestamps)
        
        # Calculate total portfolio value at each timestamp
        portfolio_history = []
        for timestamp in sorted_timestamps:
            total_value = 0
            
            for asset_history in history_data:
                # Find closest price for this timestamp
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
        
        return {
            'history': portfolio_history,
            'days': days,
            'data_points': len(portfolio_history)
        }

@app.get("/search/{query}")
async def search_crypto(query: str, limit: int = 20):
    """Search for ANY cryptocurrency by name or symbol"""
    if len(query) < 2:
        raise HTTPException(status_code=400, detail="Query must be at least 2 characters")
    
    async with httpx.AsyncClient() as client:
        try:
            url = "https://api.coingecko.com/api/v3/search"
            params = {'query': query}
            response = await client.get(url, params=params, timeout=10)
            response.raise_for_status()
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