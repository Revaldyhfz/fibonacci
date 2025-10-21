# portfolio_service/main.py - FIXED VERSION with Concurrent Fetching & Optimized Aggregation
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import httpx
import asyncio # <-- Added import
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

    # --- Fetch prices concurrently ---
    async with httpx.AsyncClient() as client:
        price_tasks = [get_crypto_price(asset.coin_id) for asset in assets]
        price_results = await asyncio.gather(*[asyncio.create_task(task) for task in price_tasks], return_exceptions=True)

    # --- Process results ---
    for i, asset in enumerate(assets):
        price_result = price_results[i]
        if isinstance(price_result, Exception):
            print(f"  ❌ Error fetching price for {asset.symbol}: {price_result}")
            # Add asset with error info
            enriched_assets.append({
                'symbol': asset.symbol.upper(),
                'coin_id': asset.coin_id,
                'amount': asset.amount,
                'error': f"Failed to fetch price: {getattr(price_result, 'detail', str(price_result))}",
                'current_price': None,
                'current_value': None
            })
            continue # Skip to next asset

        # Price fetched successfully
        price_data = price_result
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


async def fetch_single_coin_history(client: httpx.AsyncClient, asset: Asset, days: int):
    """Helper function to fetch history for one coin, returns structured data or None on error."""
    try:
        print(f"  Fetching {asset.symbol} history ({days} days)...") # Added days for clarity
        url = f"https://api.coingecko.com/api/v3/coins/{asset.coin_id}/market_chart"
        params = {
            'vs_currency': 'usd',
            'days': str(days),
            # Adjust interval based on days for better granularity vs API limits
            'interval': 'hourly' if days <= 2 else 'daily'
        }
        response = await rate_limited_request(client, url, params)
        data = response.json()
        prices = data.get('prices', [])
        print(f"    -> Fetched {len(prices)} points for {asset.symbol}") # Log points fetched
        return {
            'coin_id': asset.coin_id,
            'symbol': asset.symbol,
            'amount': asset.amount,
            'prices': prices # prices are [timestamp, price]
        }
    except HTTPException as e:
        print(f"  ⚠️ Skipping history fetch for {asset.coin_id}: {e.detail}")
        return None # Indicate error for this asset
    except Exception as e:
        print(f"  ❌ Error fetching history for {asset.coin_id}: {e}")
        return None # Indicate error for this asset


@app.post("/portfolio/history")
async def get_portfolio_history(assets: List[Asset], days: int = 7):
    """Get historical data with aggressive caching and CONCURRENT fetching."""
    if not assets:
        return {'history': []}

    # Create cache key based on assets AND days
    asset_ids = sorted([a.coin_id for a in assets])
    cache_key = f"history_{'-'.join(asset_ids)}_{days}"

    # Check cache (1 hour TTL for history)
    if cache_key in history_cache:
        cached_data = history_cache[cache_key]
        if (datetime.now() - cached_data['timestamp']).seconds < HISTORY_CACHE_DURATION:
            print(f"✓ Using cached history ({len(cached_data['data']['history'])} points) for {days} days")
            return cached_data['data']

    print(f"📈 Fetching history for {len(assets)} assets over {days} days...")

    async with httpx.AsyncClient() as client:
        # Fetch concurrently
        tasks = [fetch_single_coin_history(client, asset, days) for asset in assets]
        results = await asyncio.gather(*tasks)
        # Filter out None results (errors)
        history_data = [res for res in results if res is not None and res['prices']] # Also ensure prices list is not empty
        print(f"  -> Successfully fetched history for {len(history_data)} assets.")

        if not history_data:
            if all(res is None for res in results):
                 raise HTTPException(status_code=503, detail="Failed to fetch historical data for all assets from CoinGecko.")
            return {'history': [], 'error': 'No valid historical price data points available after fetching.'}

        # --- START OF IMPROVED AGGREGATION ---
        all_timestamps = set()
        for asset_history in history_data:
            for timestamp, _ in asset_history['prices']:
                all_timestamps.add(int(timestamp)) # Ensure timestamps are integers

        if not all_timestamps:
             print("⚠️ No timestamps found in fetched history data.")
             return {'history': [], 'error': 'No price points found in historical data.'}

        sorted_timestamps = sorted(list(all_timestamps))
        print(f"  -> Aggregating data across {len(sorted_timestamps)} unique timestamps.")

        portfolio_history = []
        # Store the latest known price for each asset {coin_id: price}
        latest_prices = {asset_hist['coin_id']: None for asset_hist in history_data}
        # Create iterators for each asset's sorted price list
        asset_iterators = {
            asset_hist['coin_id']: iter(sorted(asset_hist['prices'], key=lambda x: x[0]))
            for asset_hist in history_data
        }
        # Store the current point (timestamp, price) for each asset iterator
        current_points = {
            asset_id: next(iterator, None) for asset_id, iterator in asset_iterators.items()
        }

        for timestamp in sorted_timestamps:
            total_value = 0.0
            for asset_hist in history_data:
                asset_id = asset_hist['coin_id']

                # Advance the iterator for this asset up to the current timestamp
                # Update latest_prices[asset_id] whenever we pass a point for that asset
                while current_points[asset_id] and current_points[asset_id][0] <= timestamp:
                     latest_prices[asset_id] = current_points[asset_id][1] # Update latest price
                     current_points[asset_id] = next(asset_iterators[asset_id], None) # Move to next point for this asset

                # Use the latest known price for calculation
                if latest_prices[asset_id] is not None:
                    total_value += latest_prices[asset_id] * asset_hist['amount']

            # Only add data points where we actually calculated a value > 0
            # (Avoids adding points at the start if price data isn't available yet)
            if total_value > 0.0001: # Use a small threshold to avoid floating point issues
                portfolio_history.append({
                    'timestamp': timestamp,
                    'date': datetime.fromtimestamp(timestamp / 1000).isoformat(), # Use fromtimestamp for ms
                    'value': round(total_value, 2)
                })
        # --- END OF IMPROVED AGGREGATION ---

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

        print(f"✓ History aggregated: {len(portfolio_history)} data points")

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

# Clear old cache entries periodically (Can be enhanced with a background task)
# @app.on_event("startup")
# async def startup_event():
#    async def clean_cache():
#        while True:
#            await asyncio.sleep(600) # Clean every 10 mins
#            now = datetime.now()
#            # Clean price cache
#            expired_prices = [k for k, v in price_cache.items() if (now - v['timestamp']).seconds > PRICE_CACHE_DURATION]
#            for k in expired_prices: del price_cache[k]
#            # Clean history cache
#            expired_history = [k for k, v in history_cache.items() if (now - v['timestamp']).seconds > HISTORY_CACHE_DURATION]
#            for k in expired_history: del history_cache[k]
#            print(f"🧹 Cache cleaned. Prices: {len(price_cache)}, History: {len(history_cache)}")
#    asyncio.create_task(clean_cache())


@app.on_event("startup")
async def startup_event():
    print("🚀 Portfolio Service started")
    print(f"⏱️ Rate limit: {API_RATE_LIMIT}s between calls")
    print(f"💾 Price cache TTL: {PRICE_CACHE_DURATION}s")
    print(f"📊 History cache TTL: {HISTORY_CACHE_DURATION}s")