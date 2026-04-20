"""Per-scope DRF throttles for sensitive auth endpoints.

Rates are driven by `DEFAULT_THROTTLE_RATES` in settings.py:
    login:    10/min   — slows down credential-stuffing attempts
    register:  5/hour  — stops signup spam
    search:   30/min   — protects upstream Yahoo / Binance calls

Using `AnonRateThrottle` as the base means throttling is keyed by IP address,
which is the right granularity for endpoints called before a user exists
(login, register) or as an anonymous visitor (search preview).
"""
from rest_framework.throttling import AnonRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    scope = "login"


class RegisterRateThrottle(AnonRateThrottle):
    scope = "register"


class SearchRateThrottle(AnonRateThrottle):
    scope = "search"
