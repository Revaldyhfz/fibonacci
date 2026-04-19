"""
Tests for `core.permissions` — the custom DRF permission classes and the
`is_admin` helper — plus the signal that auto-assigns the User group.
"""

import pytest
from unittest.mock import Mock

from core.permissions import (
    ADMIN_GROUP,
    USER_GROUP,
    IsAdminRole,
    IsOwner,
    IsOwnerOrAdmin,
    is_admin,
)


pytestmark = pytest.mark.django_db


def test_is_admin_false_for_anonymous():
    anon = Mock(is_authenticated=False)
    assert is_admin(anon) is False


def test_is_admin_false_for_none():
    assert is_admin(None) is False


def test_is_admin_false_for_regular_user(alice):
    assert is_admin(alice) is False


def test_is_admin_true_for_admin_group_member(admin_user):
    assert is_admin(admin_user) is True


def test_is_admin_true_for_superuser(user_factory):
    su = user_factory(username="su", is_superuser=True, is_staff=True)
    assert is_admin(su) is True


def test_signal_assigns_user_group_on_creation(alice):
    assert alice.groups.filter(name=USER_GROUP).exists()


def test_signal_skips_superuser(user_factory):
    su = user_factory(username="su2", is_superuser=True)
    assert not su.groups.filter(name=USER_GROUP).exists()


def test_is_owner_allows_record_owner(alice):
    obj = Mock(user_id=alice.id)
    request = Mock(user=alice)
    assert IsOwner().has_object_permission(request, None, obj) is True


def test_is_owner_denies_other_user(alice, bob):
    obj = Mock(user_id=alice.id)
    request = Mock(user=bob)
    assert IsOwner().has_object_permission(request, None, obj) is False


def test_is_owner_or_admin_allows_admin_on_any_record(alice, admin_user):
    obj = Mock(user_id=alice.id)
    request = Mock(user=admin_user)
    assert IsOwnerOrAdmin().has_object_permission(request, None, obj) is True


def test_is_admin_role_denies_regular_user(alice):
    request = Mock(user=alice)
    assert IsAdminRole().has_permission(request, None) is False


def test_is_admin_role_allows_admin(admin_user):
    request = Mock(user=admin_user)
    assert IsAdminRole().has_permission(request, None) is True


def test_admin_group_name_constant_is_stable():
    assert ADMIN_GROUP == "Admin"
    assert USER_GROUP == "User"
