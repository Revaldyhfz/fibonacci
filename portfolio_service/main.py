# portfolio_service/main.py - BINANCE PRIMARY with CoinGecko Fallback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, timedelta
import httpx
import asyncio

app = FastAPI(title="Crypto Portfolio Service (Binance)")

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "portfolio-service"}

@app.get("/ready")
def readiness_check():
    return {"status": "ready"}

@app.get("/live")
def liveness_check():
    return {"status": "alive", "service": "portfolio-service"}

ALLOWED_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Caching
price_cache = {}
history_cache = {}
symbol_info_cache = {}
PRICE_CACHE_DURATION = 60  # 1 minute for Binance (fast updates)
HISTORY_CACHE_DURATION = 1800  # 30 minutes
SYMBOL_CACHE_DURATION = 86400  # 24 hours

# Binance endpoints
BINANCE_API = "https://api.binance.com/api/v3"
COINGECKO_API = "https://api.coingecko.com/api/v3"

class Asset(BaseModel):
    symbol: str
    coin_id: str  # Now stores Binance symbol (e.g., "BTCUSDT") or CoinGecko ID
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

def is_binance_symbol(coin_id: str) -> bool:
    """Check if coin_id is a Binance trading pair (ends with USDT)"""
    return coin_id.upper().endswith('USDT') or coin_id.upper().endswith('BUSD')

async def get_binance_price(symbol: str) -> Optional[Dict]:
    """Fetch price from Binance (very high rate limit: 1200/min)"""
    symbol = symbol.upper()
    cache_key = f"binance_price_{symbol}"
    
    # Check cache
    if cache_key in price_cache:
        cached_data = price_cache[cache_key]
        if (datetime.now() - cached_data['timestamp']).seconds < PRICE_CACHE_DURATION:
            return cached_data['data']
    
    try:
        async with httpx.AsyncClient() as client:
            # Get 24hr ticker stats
            url = f"{BINANCE_API}/ticker/24hr"
            response = await client.get(url, params={'symbol': symbol}, timeout=10)
            
            if response.status_code != 200:
                return None
                
            data = response.json()
            
            result = {
                'price_usd': float(data['lastPrice']),
                'change_24h': float(data['priceChangePercent']),
                'volume_24h': float(data['quoteVolume']),
                'source': 'binance',
                'symbol': symbol
            }
            
            # Cache
            price_cache[cache_key] = {
                'data': result,
                'timestamp': datetime.now()
            }
            
            return result
            
    except Exception as e:
        print(f"  ⚠️ Binance error for {symbol}: {e}")
        return None

async def get_coingecko_price(coin_id: str) -> Optional[Dict]:
    """Fallback to CoinGecko for coins not on Binance"""
    cache_key = f"gecko_price_{coin_id}"
    
    if cache_key in price_cache:
        cached_data = price_cache[cache_key]
        if (datetime.now() - cached_data['timestamp']).seconds < 300:  # 5 min cache
            return cached_data['data']
    
    try:
        async with httpx.AsyncClient() as client:
            await asyncio.sleep(1.5)  # Rate limit: ~30/min for free tier
            
            url = f"{COINGECKO_API}/simple/price"
            params = {
                'ids': coin_id.lower(),
                'vs_currencies': 'usd',
                'include_24hr_change': 'true'
            }
            
            response = await client.get(url, params=params, timeout=10)
            
            if response.status_code != 200:
                return None
                
            data = response.json()
            
            if coin_id.lower() not in data:
                return None
            
            coin_data = data[coin_id.lower()]
            
            result = {
                'price_usd': coin_data['usd'],
                'change_24h': coin_data.get('usd_24h_change', 0),
                'volume_24h': 0,
                'source': 'coingecko',
                'symbol': coin_id
            }
            
            price_cache[cache_key] = {
                'data': result,
                'timestamp': datetime.now()
            }
            
            return result
            
    except Exception as e:
        print(f"  ⚠️ CoinGecko error for {coin_id}: {e}")
        return None

async def get_crypto_price_smart(coin_id: str) -> Dict:
    """Smart price fetching: Binance first, CoinGecko fallback"""
    
    # Try Binance if it looks like a Binance symbol
    if is_binance_symbol(coin_id):
        price_data = await get_binance_price(coin_id.upper())
        if price_data:
            return price_data
    
    # Try CoinGecko as fallback
    price_data = await get_coingecko_price(coin_id)
    if price_data:
        return price_data
    
    # If both fail
    raise HTTPException(404, f"Could not fetch price for {coin_id} from any source")

@app.get("/")
def root():
    return {
        "message": "Crypto Portfolio Service",
        "primary_source": "Binance API (1200 req/min)",
        "fallback_source": "CoinGecko API",
        "status": "operational"
    }

@app.get("/price/{coin_id}")
async def get_price_endpoint(coin_id: str):
    """Get current price from best available source"""
    return await get_crypto_price_smart(coin_id)

@app.post("/portfolio/calculate")
async def calculate_portfolio(assets: List[Asset]):
    """Calculate portfolio using Binance + CoinGecko"""
    
    if not assets:
        return PortfolioSummary(
            total_value_usd=0, total_cost=0, total_pnl=0, 
            total_pnl_percent=0, assets=[]
        )
    
    print(f"💼 Calculating portfolio for {len(assets)} assets...")
    
    # Fetch all prices concurrently
    price_tasks = [get_crypto_price_smart(asset.coin_id) for asset in assets]
    price_results = await asyncio.gather(*price_tasks, return_exceptions=True)
    
    total_value = 0.0
    total_cost = 0.0
    enriched_assets = []
    
    for i, asset in enumerate(assets):
        price_result = price_results[i]
        
        if isinstance(price_result, Exception):
            enriched_assets.append({
                'symbol': asset.symbol.upper(),
                'coin_id': asset.coin_id,
                'amount': asset.amount,
                'error': f"Price unavailable: {str(price_result)}",
                'current_price': None,
                'current_value': None
            })
            continue
        
        price_data = price_result
        current_price = price_data['price_usd']
        current_value = asset.amount * current_price
        
        if asset.purchase_price:
            cost = asset.amount * asset.purchase_price
            pnl = current_value - cost
            pnl_percent = (pnl / cost * 100) if cost > 0 else 0
            total_cost += cost
        else:
            cost, pnl, pnl_percent = 0, 0, 0
        
        total_value += current_value
        
        enriched_assets.append({
            'symbol': asset.symbol.upper(),
            'coin_id': asset.coin_id,
            'amount': asset.amount,
            'current_price': round(current_price, 6),
            'current_value': round(current_value, 2),
            'purchase_price': asset.purchase_price,
            'cost': round(cost, 2) if asset.purchase_price else None,
            'pnl': round(pnl, 2) if asset.purchase_price else None,
            'pnl_percent': round(pnl_percent, 2) if asset.purchase_price else None,
            'change_24h': round(price_data.get('change_24h', 0), 2),
            'source': price_data['source'],
            'notes': asset.notes
        })
    
    total_pnl = total_value - total_cost if total_cost > 0 else 0
    total_pnl_percent = (total_pnl / total_cost * 100) if total_cost > 0 else 0
    
    print(f"✅ Portfolio: ${total_value:.2f}")
    
    return PortfolioSummary(
        total_value_usd=round(total_value, 2),
        total_cost=round(total_cost, 2),
        total_pnl=round(total_pnl, 2),
        total_pnl_percent=round(total_pnl_percent, 2),
        assets=enriched_assets
    )

async def fetch_binance_history(symbol: str, days: int) -> Optional[List]:
    """Fetch historical data from Binance (klines/candlesticks)"""
    try:
        # Binance klines: 1000 data points max per request
        if days <= 1:
            interval = '15m'  # 15-minute candles (96 per day)
        elif days <= 7:
            interval = '1h'   # Hourly (168 per week)
        elif days <= 30:
            interval = '4h'   # 4-hour (180 per month)
        else:
            interval = '1d'   # Daily
        
        end_time = int(datetime.now().timestamp() * 1000)
        start_time = int((datetime.now() - timedelta(days=days)).timestamp() * 1000)
        
        async with httpx.AsyncClient() as client:
            url = f"{BINANCE_API}/klines"
            params = {
                'symbol': symbol.upper(),
                'interval': interval,
                'startTime': start_time,
                'endTime': end_time,
                'limit': 1000
            }
            
            response = await client.get(url, params=params, timeout=15)
            
            if response.status_code != 200:
                return None
            
            klines = response.json()
            
            # Convert klines to price points: [timestamp, close_price]
            prices = [[int(k[0]), float(k[4])] for k in klines]  # k[4] is close price
            
            print(f"    ✓ Binance: {len(prices)} points for {symbol}")
            return prices
            
    except Exception as e:
        print(f"  ⚠️ Binance history error for {symbol}: {e}")
        return None

async def fetch_coingecko_history(coin_id: str, days: int) -> Optional[List]:
    """Fallback: Fetch from CoinGecko"""
    try:
        await asyncio.sleep(2)  # Rate limit protection
        
        async with httpx.AsyncClient() as client:
            url = f"{COINGECKO_API}/coins/{coin_id}/market_chart"
            params = {
                'vs_currency': 'usd',
                'days': str(days),
                'interval': 'hourly' if days <= 7 else 'daily'
            }
            
            response = await client.get(url, params=params, timeout=15)
            
            if response.status_code != 200:
                return None
            
            data = response.json()
            prices = data.get('prices', [])
            
            print(f"    ✓ CoinGecko: {len(prices)} points for {coin_id}")
            return prices
            
    except Exception as e:
        print(f"  ⚠️ CoinGecko history error for {coin_id}: {e}")
        return None

async def fetch_coin_history_smart(asset: Asset, days: int):
    """Smart history fetching with Binance priority"""
    
    # Try Binance first
    if is_binance_symbol(asset.coin_id):
        prices = await fetch_binance_history(asset.coin_id, days)
        if prices:
            return {
                'coin_id': asset.coin_id,
                'symbol': asset.symbol,
                'amount': asset.amount,
                'prices': prices,
                'source': 'binance'
            }
    
    # Fallback to CoinGecko
    prices = await fetch_coingecko_history(asset.coin_id, days)
    if prices:
        return {
            'coin_id': asset.coin_id,
            'symbol': asset.symbol,
            'amount': asset.amount,
            'prices': prices,
            'source': 'coingecko'
        }
    
    return None

@app.post("/portfolio/history")
async def get_portfolio_history(assets: List[Asset], days: int = 7):
    """Get historical portfolio value using Binance + CoinGecko with purchase date awareness"""
    
    print(f"📈 History: {len(assets)} assets, {days} days")
    
    if not assets:
        return {'history': [], 'message': 'No assets provided'}
    
    # Cache disabled for purchase-date-aware calculations
    # (Each request may have different purchase dates for same assets)
    
    # Fetch all histories concurrently
    tasks = [fetch_coin_history_smart(asset, days) for asset in assets]
    results = await asyncio.gather(*tasks)
    history_data = [r for r in results if r and r['prices']]
    
    if not history_data:
        return {
            'history': [],
            'error': 'No historical data available',
            'days': days
        }
    
    # Map asset purchase dates (in milliseconds)
    asset_purchase_times = {}
    assets_without_dates = []
    
    for i, asset in enumerate(assets):
        result = results[i]
        if result and result['prices']:
            if asset.purchase_date:
                # Convert purchase_date to timestamp in milliseconds
                purchase_ts = int(asset.purchase_date.timestamp() * 1000)
                asset_purchase_times[result['coin_id']] = purchase_ts
                print(f"  📅 {asset.symbol}: purchased on {asset.purchase_date.strftime('%Y-%m-%d')}")
            else:
                # No purchase date means "owned for entire period"
                asset_purchase_times[result['coin_id']] = 0  # Beginning of time
                assets_without_dates.append(asset.symbol)
    
    if assets_without_dates:
        print(f"  ⚠️ No purchase dates for: {', '.join(assets_without_dates)} (assuming held entire period)")
    
    # Aggregate timestamps
    all_timestamps = set()
    for asset_hist in history_data:
        for timestamp, _ in asset_hist['prices']:
            all_timestamps.add(int(timestamp))
    
    if not all_timestamps:
        return {'history': [], 'error': 'No price points', 'days': days}
    
    sorted_timestamps = sorted(list(all_timestamps))
    print(f"  ⚙️ Aggregating {len(sorted_timestamps)} timestamps with purchase date filtering...")
    
    # Build portfolio history with forward-fill AND purchase date filtering
    portfolio_history = []
    latest_prices = {a['coin_id']: None for a in history_data}
    asset_iters = {
        a['coin_id']: iter(sorted(a['prices'], key=lambda x: x[0]))
        for a in history_data
    }
    current_points = {
        aid: next(aiter, None) for aid, aiter in asset_iters.items()
    }
    
    for ts in sorted_timestamps:
        total_value = 0.0
        
        for asset_hist in history_data:
            aid = asset_hist['coin_id']
            
            # CRITICAL: Only include this asset if it was owned at this timestamp
            purchase_time = asset_purchase_times.get(aid, 0)
            if ts < purchase_time:
                # Asset wasn't owned yet at this point in time
                continue
            
            # Update latest price
            while current_points[aid] and current_points[aid][0] <= ts:
                latest_prices[aid] = current_points[aid][1]
                current_points[aid] = next(asset_iters[aid], None)
            
            # Calculate value (only if asset was owned at this time)
            if latest_prices[aid] is not None:
                total_value += latest_prices[aid] * asset_hist['amount']
        
        if total_value > 0.01:
            portfolio_history.append({
                'timestamp': ts,
                'date': datetime.fromtimestamp(ts / 1000).isoformat(),
                'value': round(total_value, 2)
            })
    
    result = {
        'history': portfolio_history,
        'days': days,
        'data_points': len(portfolio_history),
        'sources': list(set([a['source'] for a in history_data])),
        'assets_without_purchase_date': assets_without_dates
    }
    
    print(f"✅ {len(portfolio_history)} points aggregated with purchase date awareness")
    
    return result

@app.get("/binance/symbols")
async def get_binance_symbols():
    """Get all available Binance trading pairs"""
    cache_key = "binance_symbols"
    
    if cache_key in symbol_info_cache:
        cached = symbol_info_cache[cache_key]
        if (datetime.now() - cached['timestamp']).seconds < SYMBOL_CACHE_DURATION:
            return cached['data']
    
    try:
        async with httpx.AsyncClient() as client:
            url = f"{BINANCE_API}/exchangeInfo"
            response = await client.get(url, timeout=10)
            data = response.json()
            
            # Filter for USDT pairs only
            usdt_symbols = [
                {
                    'symbol': s['symbol'],
                    'baseAsset': s['baseAsset'],
                    'quoteAsset': s['quoteAsset'],
                    'status': s['status']
                }
                for s in data['symbols']
                if s['quoteAsset'] == 'USDT' and s['status'] == 'TRADING'
            ]
            
            result = {
                'count': len(usdt_symbols),
                'symbols': usdt_symbols
            }
            
            symbol_info_cache[cache_key] = {
                'data': result,
                'timestamp': datetime.now()
            }
            
            return result
            
    except Exception as e:
        raise HTTPException(503, f"Failed to fetch Binance symbols: {e}")

@app.get("/search/{query}")
async def search_crypto(query: str, limit: int = 20):
    """Search for crypto symbols"""
    if len(query) < 1:
        raise HTTPException(400, "Query too short")
    
    query = query.upper()
    
    # Get Binance symbols
    binance_data = await get_binance_symbols()
    
    # Filter matching symbols
    matches = [
        s for s in binance_data['symbols']
        if query in s['baseAsset'] or query in s['symbol']
    ][:limit]
    
    results = [
        {
            'id': m['symbol'],
            'symbol': m['baseAsset'],
            'name': f"{m['baseAsset']}/USDT",
            'binance_symbol': m['symbol'],
            'source': 'binance'
        }
        for m in matches
    ]
    
    return {
        'query': query,
        'count': len(results),
        'results': results
    }

@app.on_event("startup")
async def startup():
    print("🚀 Portfolio Service Started (Binance Primary)")
    print("   📊 Binance: 1200 req/min")
    print("   🦎 CoinGecko: Fallback only")
    print("   🎯 Port: 8002")