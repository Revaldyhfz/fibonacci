"""Tiny in-process TTL cache.

Replaces the old pattern of `(datetime.now() - ts).seconds < N`, which broke
silently for intervals longer than a day because `.seconds` only counts the
sub-day portion of a timedelta. `.total_seconds()` is correct.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple


class TTLCache:
    def __init__(self, ttl_seconds: float) -> None:
        self.ttl = timedelta(seconds=ttl_seconds)
        self._store: Dict[str, Tuple[datetime, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if entry is None:
            return None
        timestamp, value = entry
        if (datetime.now() - timestamp) > self.ttl:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any) -> None:
        self._store[key] = (datetime.now(), value)

    def clear(self) -> None:
        self._store.clear()

    def __len__(self) -> int:
        return len(self._store)
