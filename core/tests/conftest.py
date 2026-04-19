"""
Shared pytest fixtures for the core app test suite.
"""

import pytest
from django.contrib.auth.models import Group, User
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from core.permissions import ADMIN_GROUP, USER_GROUP


@pytest.fixture(autouse=True)
def role_groups(db):
    """Ensure the User + Admin groups exist before every test."""
    Group.objects.get_or_create(name=USER_GROUP)
    Group.objects.get_or_create(name=ADMIN_GROUP)


@pytest.fixture
def user_factory(db):
    """Factory for creating User objects with deterministic usernames."""
    counter = {"n": 0}

    def _make(username=None, password="test-pass-1234", is_admin=False, **kwargs):
        counter["n"] += 1
        uname = username or f"user{counter['n']}"
        user = User.objects.create_user(username=uname, password=password, **kwargs)
        if is_admin:
            admin_group = Group.objects.get(name=ADMIN_GROUP)
            user.groups.add(admin_group)
        return user

    return _make


@pytest.fixture
def alice(user_factory):
    return user_factory(username="alice", email="alice@example.com")


@pytest.fixture
def bob(user_factory):
    return user_factory(username="bob", email="bob@example.com")


@pytest.fixture
def admin_user(user_factory):
    return user_factory(username="root", email="root@example.com", is_admin=True)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def client_for():
    """Return a helper that builds an APIClient authenticated as the given user."""

    def _auth(user):
        client = APIClient()
        refresh = RefreshToken.for_user(user)
        client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        return client

    return _auth
