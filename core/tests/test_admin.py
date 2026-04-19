"""
Tests for the admin-only endpoints: /api/admin/overview/ + /api/admin/users/.

Verifies that non-admins are denied and that the response shape matches what
the frontend AdminPage expects.
"""

from datetime import datetime, timezone

import pytest
from django.urls import reverse

from core.models import Strategy, Trade


pytestmark = pytest.mark.django_db


def _trade_date(day=1):
    return datetime(2026, 4, day, 10, 0, 0, tzinfo=timezone.utc)


def test_admin_overview_denies_anonymous(api_client):
    response = api_client.get(reverse("admin-overview"))
    assert response.status_code == 401


def test_admin_overview_denies_regular_user(client_for, alice):
    client = client_for(alice)
    response = client.get(reverse("admin-overview"))
    assert response.status_code == 403


def test_admin_overview_allows_admin_and_returns_expected_shape(
    client_for, admin_user, alice, bob
):
    # Seed some data so the aggregates aren't all zero
    Strategy.objects.create(user=alice, name="Breakout")
    Trade.objects.create(
        user=alice,
        symbol="BTC-USD",
        trade_date=_trade_date(1),
        entry_price="50000",
        exit_price="51000",
        position_size=1,
    )

    client = client_for(admin_user)
    response = client.get(reverse("admin-overview"))
    assert response.status_code == 200

    body = response.json()
    expected_keys = {
        "users_total",
        "users_admin",
        "users_active_7d",
        "trades_total",
        "assets_total",
        "strategies_total",
        "winning_trades",
        "losing_trades",
        "total_pnl",
    }
    assert expected_keys.issubset(body.keys())
    # 3 users: alice + bob + admin (via fixtures)
    assert body["users_total"] == 3
    assert body["users_admin"] >= 1
    assert body["trades_total"] == 1
    assert body["strategies_total"] == 1


def test_admin_users_denies_regular_user(client_for, alice):
    client = client_for(alice)
    response = client.get(reverse("admin-users"))
    assert response.status_code == 403


def test_admin_users_returns_flat_list_with_counts(
    client_for, admin_user, alice
):
    Strategy.objects.create(user=alice, name="Swing")
    Trade.objects.create(
        user=alice,
        symbol="ETH-USD",
        trade_date=_trade_date(2),
        entry_price="3000",
        exit_price="3100",
        position_size=1,
    )

    client = client_for(admin_user)
    response = client.get(reverse("admin-users"))
    assert response.status_code == 200

    users = response.json()
    assert isinstance(users, list), "Frontend expects a flat list, not a paginated wrapper"

    alice_entry = next(u for u in users if u["username"] == "alice")
    assert alice_entry["trades_count"] == 1
    assert alice_entry["strategies_count"] == 1
    assert alice_entry["assets_count"] == 0
    assert alice_entry["is_admin"] is False
