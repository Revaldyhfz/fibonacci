"""
Test-only Django settings.

Overrides the base settings to run against an in-memory SQLite DB so pytest
doesn't need a running Postgres. Password hashing is switched to MD5 to cut
seconds off large test suites — never ship this module to production.
"""

from .settings import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

SECRET_KEY = "test-secret-key-not-used-in-production"
DEBUG = False
