"""
Tests that `_UserScopedModelViewSet` isolates records per user — a user cannot
list or retrieve records owned by another user, and admins see everything.
"""

from datetime import datetime, timezone

import pytest
from django.urls import reverse

from core.models import CryptoAsset, Strategy, Trade


pytestmark = pytest.mark.django_db


def _trade_date(day=1):
    return datetime(2026, 4, day, 10, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def seeded_trades(alice, bob):
    alice_trade = Trade.objects.create(
        user=alice,
        symbol="BTC-USD",
        trade_date=_trade_date(1),
        entry_price="50000",
        exit_price="51000",
        position_size=1,
    )
    bob_trade = Trade.objects.create(
        user=bob,
        symbol="ETH-USD",
        trade_date=_trade_date(2),
        entry_price="3000",
        exit_price="2900",
        position_size=1,
    )
    return alice_trade, bob_trade


def test_trades_list_only_returns_own_records(client_for, alice, seeded_trades):
    alice_trade, bob_trade = seeded_trades
    client = client_for(alice)

    response = client.get(reverse("trade-list"))
    assert response.status_code == 200
    ids = {t["id"] for t in response.json()}
    assert alice_trade.id in ids
    assert bob_trade.id not in ids


def test_trade_detail_returns_404_for_other_users_record(client_for, alice, seeded_trades):
    _, bob_trade = seeded_trades
    client = client_for(alice)

    response = client.get(reverse("trade-detail", args=[bob_trade.id]))
    assert response.status_code == 404


def test_trade_delete_returns_404_for_other_users_record(client_for, alice, seeded_trades):
    _, bob_trade = seeded_trades
    client = client_for(alice)

    response = client.delete(reverse("trade-detail", args=[bob_trade.id]))
    assert response.status_code == 404
    # Confirm it actually still exists
    assert Trade.objects.filter(id=bob_trade.id).exists()


def test_admin_sees_all_trades(client_for, admin_user, seeded_trades):
    client = client_for(admin_user)

    response = client.get(reverse("trade-list"))
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_strategy_scoping(client_for, alice, bob):
    alice_strategy = Strategy.objects.create(user=alice, name="Alice-Breakout")
    Strategy.objects.create(user=bob, name="Bob-Swing")

    client = client_for(alice)
    response = client.get(reverse("strategy-list"))
    assert response.status_code == 200
    names = {s["name"] for s in response.json()}
    assert names == {"Alice-Breakout"}

    # Alice cannot delete Bob's strategy
    bob_strategy = Strategy.objects.get(name="Bob-Swing")
    del_response = client.delete(reverse("strategy-detail", args=[bob_strategy.id]))
    assert del_response.status_code == 404

    # Alice's own strategy reads back with the right id
    detail = client.get(reverse("strategy-detail", args=[alice_strategy.id]))
    assert detail.status_code == 200


def test_crypto_asset_scoping(client_for, alice, bob):
    CryptoAsset.objects.create(user=alice, symbol="BTC", coin_id="bitcoin", amount="0.5")
    CryptoAsset.objects.create(user=bob, symbol="ETH", coin_id="ethereum", amount="2.0")

    client = client_for(alice)
    response = client.get(reverse("crypto-asset-list"))
    assert response.status_code == 200
    symbols = {a["symbol"] for a in response.json()}
    assert symbols == {"BTC"}


def test_trade_stats_only_counts_own_records(client_for, alice, seeded_trades):
    # Alice should only see her one winning trade in stats
    client = client_for(alice)
    response = client.get(reverse("trade-stats"))
    assert response.status_code == 200
    body = response.json()
    assert body["total_trades"] == 1
    assert body["wins"] == 1


def test_trade_creation_ignores_submitted_user(client_for, alice, bob):
    """The serializer overrides `user` with request.user — submitting a
    different user id must not spoof ownership."""
    client = client_for(alice)
    payload = {
        "symbol": "BTC-USD",
        "trade_date": "2026-04-10T10:00:00Z",
        "entry_price": "50000",
        "exit_price": "51000",
        "position_size": 1,
        "user": bob.id,  # attempted spoof
    }
    response = client.post(reverse("trade-list"), payload, format="json")
    assert response.status_code == 201
    trade = Trade.objects.get(id=response.json()["id"])
    assert trade.user == alice  # not bob
