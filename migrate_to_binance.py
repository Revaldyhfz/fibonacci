# migrate_to_binance.py
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fibonacci_project.settings')
django.setup()

from core.models import CryptoAsset

# Common mapping (add more as needed)
COIN_MAPPING = {
    'bitcoin': 'BTCUSDT',
    'ethereum': 'ETHUSDT',
    'solana': 'SOLUSDT',
    'cardano': 'ADAUSDT',
    'ripple': 'XRPUSDT',
    'polkadot': 'DOTUSDT',
    'dogecoin': 'DOGEUSDT',
    'avalanche-2': 'AVAXUSDT',
    'polygon': 'MATICUSDT',
    'chainlink': 'LINKUSDT',
    'uniswap': 'UNIUSDT',
    'litecoin': 'LTCUSDT',
    'shiba-inu': 'SHIBUSDT',
    'tron': 'TRXUSDT',
    'dai': 'DAIUSDT',
}

assets = CryptoAsset.objects.all()
migrated = 0
skipped = 0

for asset in assets:
    if asset.coin_id in COIN_MAPPING:
        old_id = asset.coin_id
        asset.coin_id = COIN_MAPPING[old_id]
        asset.save()
        print(f"✓ {asset.symbol}: {old_id} → {asset.coin_id}")
        migrated += 1
    else:
        print(f"⚠ {asset.symbol}: Keeping '{asset.coin_id}' (will use CoinGecko fallback)")
        skipped += 1

print(f"\n✅ Migrated: {migrated}")
print(f"⚠️ Skipped: {skipped} (will use CoinGecko fallback)")