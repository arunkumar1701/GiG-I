"""
aqi_service.py
--------------
Fetches AQI data from data.gov.in with retry/backoff and short-term caching.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from settings import settings

logger = logging.getLogger(__name__)

DATAGOV_API_KEY = settings.datagov_api_key
CACHE_TTL_SECONDS = 3600
CPCB_RESOURCE_ID = "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"
RETRYABLE_STATUS_CODES = {408, 425, 429, 500, 502, 503, 504}

_aqi_cache: dict[str, tuple[int, float]] = {}


def _retry_backoff_sleep(delay_seconds: float) -> None:
    time.sleep(delay_seconds)


def _fetch_json_with_backoff(
    *,
    url: str,
    params: dict[str, Any],
    timeout_seconds: float,
    max_attempts: int = 4,
) -> dict[str, Any]:
    delay_seconds = 0.5
    with httpx.Client(timeout=timeout_seconds) as client:
        for attempt in range(1, max_attempts + 1):
            try:
                response = client.get(url, params=params)
                if response.status_code in RETRYABLE_STATUS_CODES and attempt < max_attempts:
                    logger.warning(
                        "[AQIService] Retryable HTTP %s on attempt %s/%s.",
                        response.status_code,
                        attempt,
                        max_attempts,
                    )
                    _retry_backoff_sleep(delay_seconds)
                    delay_seconds *= 2
                    continue

                response.raise_for_status()
                return response.json()
            except (httpx.TimeoutException, httpx.RequestError, httpx.TransportError) as exc:
                if attempt >= max_attempts:
                    raise
                logger.warning(
                    "[AQIService] Network failure on attempt %s/%s: %s",
                    attempt,
                    max_attempts,
                    exc,
                )
                _retry_backoff_sleep(delay_seconds)
                delay_seconds *= 2
            except httpx.HTTPStatusError:
                raise

    raise RuntimeError("AQI request failed after all retry attempts")


def get_aqi(city: str) -> dict:
    """
    Returns AQI for the given city.
    Result: { "aqi": int, "category": str, "source": "live" | "cache" | "fallback" }
    """
    city_key = city.lower()
    now = time.time()

    if city_key in _aqi_cache:
        cached_aqi, cached_at = _aqi_cache[city_key]
        if now - cached_at < CACHE_TTL_SECONDS:
            return {"aqi": cached_aqi, "category": _categorize(cached_aqi), "source": "cache"}

    if not DATAGOV_API_KEY or DATAGOV_API_KEY == "PLACEHOLDER_OPTIONAL":
        if settings.is_production:
            logger.error("[AQIService] DATAGOV_API_KEY missing in production; using degraded AQI.")
            return {"aqi": 150, "category": "Moderate", "source": "fallback"}
        logger.info("[AQIService] No API key; using fallback AQI=150 for %s", city)
        return {"aqi": 150, "category": "Moderate", "source": "fallback"}

    try:
        data = _fetch_json_with_backoff(
            url=f"https://api.data.gov.in/resource/{CPCB_RESOURCE_ID}",
            params={
                "api-key": DATAGOV_API_KEY,
                "format": "json",
                "filters[city]": city,
                "limit": 1,
            },
            timeout_seconds=6.0,
        )

        records = data.get("records", [])
        if not records:
            raise ValueError("No AQI records returned")

        aqi_value = int(float(records[0].get("aqi", 150) or 150))
        _aqi_cache[city_key] = (aqi_value, now)
        return {"aqi": aqi_value, "category": _categorize(aqi_value), "source": "live"}
    except Exception as exc:
        logger.warning("[AQIService] API call failed for %s: %s. Using fallback.", city, exc)
        return {"aqi": 150, "category": "Moderate", "source": "fallback"}


def _categorize(aqi: int) -> str:
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Satisfactory"
    if aqi <= 200:
        return "Moderate"
    if aqi <= 300:
        return "Poor"
    if aqi <= 400:
        return "Very Poor"
    return "Severe"


def aqi_to_premium_multiplier(aqi: int) -> float:
    if aqi <= 100:
        return 1.00
    if aqi <= 200:
        return 1.05
    if aqi <= 300:
        return 1.10
    if aqi <= 400:
        return 1.15
    return 1.20
