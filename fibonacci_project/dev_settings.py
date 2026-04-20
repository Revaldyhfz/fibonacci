"""Local-dev Django settings.

Defaults to file-based SQLite for zero-setup. Set USE_POSTGRES=1 to switch to the
dockerized Postgres from docker-compose.yml.
  docker compose up -d postgres
  USE_POSTGRES=1 DJANGO_SETTINGS_MODULE=fibonacci_project.dev_settings \\
    python manage.py migrate
Never use in production.
"""
import os
from .settings import *  # noqa: F401,F403

if os.environ.get("USE_POSTGRES") == "1":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("DB_NAME", "fibonacci"),
            "USER": os.environ.get("DB_USER", "postgres"),
            "PASSWORD": os.environ.get("DB_PASSWORD", "password"),
            "HOST": os.environ.get("DB_HOST", "127.0.0.1"),
            "PORT": os.environ.get("DB_PORT", "5432"),
        }
    }
else:
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
