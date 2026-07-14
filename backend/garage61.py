"""
WEC LMP Diagnostic Assistant - Garage 61 client
================================================

Thin async client for the Garage 61 public API (garage61.net/developer).
Used by the Reference Laps panel: lap times of you + your team per
car/track combination, plus the cars/tracks catalogs for the pickers.

Auth: personal access token in GARAGE61_TOKEN (or DRIVER61_API_KEY) in
backend/.env. All calls go through the backend so the token never
reaches the browser.

Confirmed endpoints (probed live):
  GET /api/v1/me                      -> account + teams
  GET /api/v1/cars                    -> {items: [{id, name, platform, platform_id}]}
  GET /api/v1/tracks                  -> {items: [{id, name, variant, ...}]}
  GET /api/v1/laps?cars=&tracks=&limit=&offset= -> {items: [...], total}

Author: Alexandru
"""

import logging
import os
import time

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "https://garage61.net/api/v1"
CATALOG_TTL_SECONDS = 3600  # cars/tracks change rarely — cache for an hour

# {path: (fetched_at, payload)}
_catalog_cache: dict[str, tuple[float, dict]] = {}


def get_token() -> str | None:
    return (
        os.environ.get("GARAGE61_TOKEN")
        or os.environ.get("DRIVER61_API_KEY")
        or None
    )


class Garage61Error(Exception):
    """Raised for any Garage 61 API failure; carries an HTTP-ish status."""

    def __init__(self, status_code: int, detail: str):
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


async def _get(path: str, params: dict | None = None) -> dict:
    token = get_token()
    if not token:
        raise Garage61Error(
            503,
            "Garage 61 not configured — add GARAGE61_TOKEN (or DRIVER61_API_KEY) to backend/.env",
        )

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{BASE_URL}{path}",
                params=params,
                headers={"Authorization": f"Bearer {token.strip()}"},
            )
    except httpx.HTTPError as e:
        raise Garage61Error(502, f"Garage 61 unreachable: {e}") from e

    if response.status_code == 401:
        raise Garage61Error(502, "Garage 61 rejected the token — regenerate it in their developer portal")
    if response.status_code >= 400:
        raise Garage61Error(502, f"Garage 61 error {response.status_code}: {response.text[:200]}")

    return response.json()


async def _get_catalog(path: str) -> dict:
    """Cars/tracks catalogs with an in-memory TTL cache."""
    now = time.monotonic()
    cached = _catalog_cache.get(path)
    if cached and now - cached[0] < CATALOG_TTL_SECONDS:
        return cached[1]

    payload = await _get(path)
    _catalog_cache[path] = (now, payload)
    return payload


async def get_status() -> dict:
    """Connection status for the frontend header of the panel."""
    if not get_token():
        return {"connected": False, "detail": "No Garage 61 token configured"}
    try:
        me = await _get("/me")
        return {
            "connected": True,
            "name": f"{me.get('firstName', '')} {me.get('lastName', '')}".strip(),
            "teams": [t.get("name") for t in me.get("teams", [])],
        }
    except Garage61Error as e:
        return {"connected": False, "detail": e.detail}


async def get_cars() -> dict:
    return await _get_catalog("/cars")


async def get_tracks() -> dict:
    return await _get_catalog("/tracks")


async def find_laps(cars: str, tracks: str, limit: int = 20, offset: int = 0) -> dict:
    """
    Laps visible to this account (own + team) for the car/track combo.
    `cars` and `tracks` are comma-separated Garage 61 ids, per their API.
    """
    return await _get(
        "/laps",
        {"cars": cars, "tracks": tracks, "limit": limit, "offset": offset},
    )
