"""Local-dev Django settings.

File-based SQLite (survives restarts), DEBUG enabled, CORS open to Vite.
Run with: DJANGO_SETTINGS_MODULE=fibonacci_project.dev_settings
Never use in production.
"""
from .settings import *  # noqa: F401,F403

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",  # noqa: F405
    }
}

DEBUG = True
ALLOWED_HOSTS = ["localhost", "127.0.0.1", "*"]

CORS_ALLOW_ALL_ORIGINS = True

SECRET_KEY = "dev-secret-not-for-prod"
