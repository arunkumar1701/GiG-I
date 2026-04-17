"""
weather_service.py
------------------
Fetches live weather data from OpenWeatherMap and evaluates disruption triggers.
Production mode relies on live API calls with retry/backoff. Non-production can
fall back to local mock data for offline development and tests.
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any, Optional

import httpx

from settings import settings

logger = logging.getLogger(__name__)

OPENWEATHER_API_KEY = settings.openweather_api_key
RAIN_TRIGGER_MM = settings.rain_trigger_mm
HEAT_TRIGGER_C = settings.heat_trigger_c

ZONE_COORDS = {
    "Zone A": (13.0827, 80.2707),
    "Zone B": (13.0604, 80.2496),
    "Zone C": (12.9941, 80.2404),
    "Zone D": (12.9716, 80.2209),
}

FALLBACK_PATH = Path(__file__).parent / "mock_data" / "weather_fallback.json"
WEATHER_CACHE_TTL_SECONDS = 300
FORECAST_CACHE_TTL_SECONDS = 1800
RETRYABLE_STATUS_CODES = {408, 425, 429, 500, 502, 503, 504}

_weather_cache: dict[str, tuple[dict[str, Any], float]] = {}
_forecast_cache: dict[str, tuple[float, float]] = {}


def _load_fallback() -> dict:
    """Offline-only fallback used in development and tests."""
    try:
        with FALLBACK_PATH.open(encoding="utf-8") as handle:
            data = json.load(handle)
        logger.warning("[WeatherService] Using local fallback weather data.")
        return data
    except FileNotFoundError:
        logger.error("[WeatherService] Fallback file missing. Returning safe defaults.")
        return {
            "rain_mm_per_hr": 0.0,
            "temp_c": 30.0,
            "weather_code": 800,
            "description": "Clear",
            "trigger": None,
        }


def _safe_weather_default(zone: str) -> dict:
    return {
        "zone": zone,
        "rain_mm_per_hr": 0.0,
        "temp_c": 30.0,
        "weather_code": 800,
        "description": "Unavailable",
        "trigger": None,
    }


def _resolve_coords(zone: str) -> tuple[float, float]:
    coords = ZONE_COORDS.get(zone)
    if coords:
        return coords
    logger.warning("[WeatherService] Unknown zone '%s'. Using Zone A coordinates.", zone)
    return ZONE_COORDS["Zone A"]


def _retry_backoff_sleep(delay_seconds: float) -> None:
    time.sleep(delay_seconds)


def _fetch_json_with_backoff(
    *,
    url: str,
    params: dict[str, Any],
    timeout_seconds: float,
    service_name: str,
    max_attempts: int = 4,
) -> dict[str, Any]:
    delay_seconds = 0.5
    with httpx.Client(timeout=timeout_seconds) as client:
        for attempt in range(1, max_attempts + 1):
            try:
                response = client.get(url, params=params)
                if response.status_code in RETRYABLE_STATUS_CODES and attempt < max_attempts:
                    logger.warning(
                        "[%s] Retryable HTTP %s on attempt %s/%s.",
                        service_name,
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
                    "[%s] Network failure on attempt %s/%s: %s",
                    service_name,
                    attempt,
                    max_attempts,
                    exc,
                )
                _retry_backoff_sleep(delay_seconds)
                delay_seconds *= 2
            except httpx.HTTPStatusError:
                raise

    raise RuntimeError(f"{service_name} request failed after {max_attempts} attempts")


def _get_cached_weather(zone: str) -> Optional[dict[str, Any]]:
    cached = _weather_cache.get(zone)
    if not cached:
        return None
    payload, cached_at = cached
    if time.time() - cached_at > WEATHER_CACHE_TTL_SECONDS:
        return None
    return payload


def _get_cached_forecast(zone: str) -> Optional[float]:
    cached = _forecast_cache.get(zone)
    if not cached:
        return None
    payload, cached_at = cached
    if time.time() - cached_at > FORECAST_CACHE_TTL_SECONDS:
        return None
    return payload


def _classify_weather(zone: str, data: dict[str, Any]) -> dict:
    rain_mm = float(data.get("rain", {}).get("1h", 0.0) or 0.0)
    temp_c = float(data.get("main", {}).get("temp", 30.0) or 30.0)
    weather = data.get("weather", [{}])
    w_code = int(weather[0].get("id", 800) or 800)
    description = str(weather[0].get("description", "clear"))

    trigger: Optional[str] = None
    if w_code // 100 == 5 and rain_mm > 5.0:
        trigger = "Flood Alert"
    elif rain_mm >= RAIN_TRIGGER_MM:
        trigger = "Heavy Rain"
    elif temp_c >= HEAT_TRIGGER_C:
        trigger = "Heatwave"

    return {
        "zone": zone,
        "rain_mm_per_hr": rain_mm,
        "temp_c": temp_c,
        "weather_code": w_code,
        "description": description,
        "trigger": trigger,
    }


def get_weather(zone: str) -> dict:
    lat, lon = _resolve_coords(zone)

    if not OPENWEATHER_API_KEY:
        if settings.is_production:
            logger.error("[WeatherService] OPENWEATHER_API_KEY missing in production; returning safe default.")
            return _safe_weather_default(zone)
        return _load_fallback()

    try:
        data = _fetch_json_with_backoff(
            url="https://api.openweathermap.org/data/2.5/weather",
            params={
                "lat": lat,
                "lon": lon,
                "appid": OPENWEATHER_API_KEY,
                "units": "metric",
            },
            timeout_seconds=3.0,  # Reduced from 8.0
            max_attempts=2,  # Reduced from default
            service_name="WeatherService",
        )
        result = _classify_weather(zone, data)
        _weather_cache[zone] = (result, time.time())
        logger.info("[WeatherService] %s -> %s", zone, result)
        return result
    except Exception as exc:
        logger.warning("[WeatherService] Live weather fetch failed for %s: %s; using fallback", zone, exc)
        cached = _get_cached_weather(zone)
        if cached:
            logger.warning("[WeatherService] Returning cached live weather for %s.", zone)
            return cached
        if settings.is_production:
            return _safe_weather_default(zone)
        return _load_fallback()


def get_forecast_disruption_hours(zone: str) -> float:
    lat, lon = _resolve_coords(zone)

    if not OPENWEATHER_API_KEY:
        if settings.is_production:
            logger.error("[WeatherService] OPENWEATHER_API_KEY missing in production; returning degraded forecast.")
            return 0.0
        logger.warning("[WeatherService] No API key; returning forecast fallback 3.0h.")
        return 3.0

    try:
        data = _fetch_json_with_backoff(
            url="https://api.openweathermap.org/data/2.5/forecast",
            params={
                "lat": lat,
                "lon": lon,
                "cnt": 56,
                "appid": OPENWEATHER_API_KEY,
                "units": "metric",
            },
            timeout_seconds=4.0,  # Reduced from 10.0
            max_attempts=2,  # Reduced from default
            service_name="WeatherService",
        )
        disrupted = sum(
            1
            for entry in data.get("list", [])
            if float(entry.get("rain", {}).get("3h", 0.0) or 0.0) / 3.0 >= RAIN_TRIGGER_MM
            or float(entry.get("main", {}).get("temp", 0.0) or 0.0) >= HEAT_TRIGGER_C
        )
        hours = round(disrupted * 0.5, 1)
        _forecast_cache[zone] = (hours, time.time())
        return hours
    except Exception as exc:
        logger.warning("[WeatherService] Forecast fetch failed for %s: %s; using fallback", zone, exc)
        cached = _get_cached_forecast(zone)
        if cached is not None:
            logger.warning("[WeatherService] Returning cached live forecast for %s.", zone)
            return cached
        return 0.0 if settings.is_production else 3.0
