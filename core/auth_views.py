"""
Auth-adjacent endpoints: current-user profile and admin user listing.

Kept separate from views.py so the file stays focused on domain models
(Trade / Strategy / CryptoAsset) while auth concerns live here.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from .permissions import ADMIN_GROUP, IsAdminRole, is_admin


def _serialize_user(user: User, *, include_counts: bool = False) -> dict:
    roles = list(user.groups.values_list("name", flat=True))
    if user.is_superuser and ADMIN_GROUP not in roles:
        roles.append(ADMIN_GROUP)

    payload = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_admin": is_admin(user),
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "roles": roles,
        "date_joined": user.date_joined.isoformat() if user.date_joined else None,
        "last_login": user.last_login.isoformat() if user.last_login else None,
    }

    if include_counts:
        payload["trades_count"] = getattr(user, "trades_count", 0) or 0
        payload["assets_count"] = getattr(user, "assets_count", 0) or 0
        payload["strategies_count"] = getattr(user, "strategies_count", 0) or 0

    return payload


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def me(request):
    """Return the current user's profile + role information."""
    return Response(_serialize_user(request.user))


@api_view(["GET"])
@permission_classes([IsAdminRole])
def admin_users(request):
    """List all users with their trade/asset/strategy counts (Admin only).

    Returns a flat array — the frontend expects a list it can map/filter.
    """
    users = (
        User.objects.all()
        .annotate(
            trades_count=Count("trades", distinct=True),
            assets_count=Count("crypto_assets", distinct=True),
            strategies_count=Count("strategies", distinct=True),
        )
        .order_by("-date_joined")
    )
    return Response([_serialize_user(u, include_counts=True) for u in users])


@api_view(["GET"])
@permission_classes([IsAdminRole])
def admin_overview(request):
    """Aggregate stats across all users — for the admin dashboard."""
    from .models import Trade, CryptoAsset, Strategy

    users_total = User.objects.count()
    users_admin = User.objects.filter(groups__name=ADMIN_GROUP).distinct().count()
    cutoff = timezone.now() - timedelta(days=7)
    users_active_7d = User.objects.filter(last_login__gte=cutoff).count()

    trades_total = Trade.objects.count()
    assets_total = CryptoAsset.objects.count()
    strategies_total = Strategy.objects.count()

    winning = Trade.objects.filter(pnl__gt=0).count()
    losing = Trade.objects.filter(pnl__lt=0).count()
    pnl_agg = Trade.objects.aggregate(total=Sum("pnl"))["total"] or 0

    return Response({
        "users_total": users_total,
        "users_admin": users_admin,
        "users_active_7d": users_active_7d,
        "trades_total": trades_total,
        "assets_total": assets_total,
        "strategies_total": strategies_total,
        "winning_trades": winning,
        "losing_trades": losing,
        "total_pnl": float(pnl_agg),
    })
