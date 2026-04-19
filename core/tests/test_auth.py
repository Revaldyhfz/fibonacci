"""
Tests for the auth surface — /api/auth/register/ and /api/auth/me/.
"""

import pytest
from django.urls import reverse


pytestmark = pytest.mark.django_db


def test_register_creates_user_and_returns_tokens(api_client):
    response = api_client.post(
        reverse("auth-register"),
        {"username": "newbie", "email": "newbie@example.com", "password": "super-pass-9"},
        format="json",
    )
    assert response.status_code == 201
    body = response.json()
    assert "access" in body
    assert "refresh" in body
    assert body["user"]["username"] == "newbie"
    assert body["user"]["is_admin"] is False
    assert "User" in body["user"]["roles"]


def test_register_rejects_duplicate_username(api_client, alice):
    response = api_client.post(
        reverse("auth-register"),
        {"username": "alice", "email": "other@example.com", "password": "super-pass-9"},
        format="json",
    )
    assert response.status_code == 400
    assert "username" in response.json()


def test_register_rejects_duplicate_email_case_insensitive(api_client, alice):
    response = api_client.post(
        reverse("auth-register"),
        {"username": "alice2", "email": "ALICE@example.com", "password": "super-pass-9"},
        format="json",
    )
    assert response.status_code == 400
    assert "email" in response.json()


def test_register_rejects_short_password(api_client):
    response = api_client.post(
        reverse("auth-register"),
        {"username": "shorty", "email": "s@example.com", "password": "abc"},
        format="json",
    )
    assert response.status_code == 400
    assert "password" in response.json()


def test_me_denies_anonymous(api_client):
    response = api_client.get(reverse("auth-me"))
    assert response.status_code == 401


def test_me_returns_user_profile(client_for, alice):
    client = client_for(alice)
    response = client.get(reverse("auth-me"))
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "alice"
    assert body["is_admin"] is False
    assert "User" in body["roles"]


def test_me_marks_admin_correctly(client_for, admin_user):
    client = client_for(admin_user)
    response = client.get(reverse("auth-me"))
    assert response.status_code == 200
    body = response.json()
    assert body["is_admin"] is True
    assert "Admin" in body["roles"]
