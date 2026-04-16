import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
os.environ["APP_ENV"] = "test"

import httpx

import weather_service


def test_weather_service_uses_fallback_without_api_key(monkeypatch):
    fallback = {
        "zone": "Zone A",
        "rain_mm_per_hr": 0.0,
        "temp_c": 30.0,
        "weather_code": 800,
        "description": "Clear fallback",
        "trigger": None,
    }
    monkeypatch.setattr(weather_service, "OPENWEATHER_API_KEY", "")
    monkeypatch.setattr(weather_service, "_load_fallback", lambda: fallback)

    result = weather_service.get_weather("Zone A")

    assert result == fallback


def test_weather_service_classifies_flood_alert_from_live_payload(monkeypatch):
    class MockResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "rain": {"1h": 6.2},
                "main": {"temp": 29.0},
                "weather": [{"id": 502, "description": "heavy rain"}],
            }

    class MockClient:
        def __init__(self, timeout):
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get(self, url, params=None):
            return MockResponse()

    monkeypatch.setattr(weather_service, "OPENWEATHER_API_KEY", "fake-key")
    monkeypatch.setattr(weather_service.httpx, "Client", MockClient)

    result = weather_service.get_weather("Zone B")

    assert result["zone"] == "Zone B"
    assert result["rain_mm_per_hr"] == 6.2
    assert result["trigger"] == "Flood Alert"


def test_forecast_disruption_hours_counts_trigger_windows(monkeypatch):
    class MockResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "list": [
                    {"rain": {"3h": 9.0}, "main": {"temp": 31.0}},
                    {"rain": {"3h": 0.0}, "main": {"temp": 41.0}},
                    {"rain": {"3h": 0.0}, "main": {"temp": 30.0}},
                ]
            }

    class MockClient:
        def __init__(self, timeout):
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get(self, url, params=None):
            return MockResponse()

    monkeypatch.setattr(weather_service, "OPENWEATHER_API_KEY", "fake-key")
    monkeypatch.setattr(weather_service.httpx, "Client", MockClient)

    result = weather_service.get_forecast_disruption_hours("Zone C")

    assert result == 1.0


def test_weather_service_retries_after_rate_limit(monkeypatch):
    attempts = {"count": 0}

    class RateLimitedResponse:
        status_code = 429

        def raise_for_status(self):
            raise httpx.HTTPStatusError(
                "rate limited",
                request=httpx.Request("GET", "https://example.com"),
                response=httpx.Response(429),
            )

        def json(self):
            return {}

    class SuccessResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "rain": {"1h": 0.2},
                "main": {"temp": 33.0},
                "weather": [{"id": 800, "description": "clear sky"}],
            }

    class MockClient:
        def __init__(self, timeout):
            self.timeout = timeout

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def get(self, url, params=None):
            attempts["count"] += 1
            if attempts["count"] == 1:
                return RateLimitedResponse()
            return SuccessResponse()

    monkeypatch.setattr(weather_service, "OPENWEATHER_API_KEY", "fake-key")
    monkeypatch.setattr(weather_service.httpx, "Client", MockClient)
    monkeypatch.setattr(weather_service, "_retry_backoff_sleep", lambda delay_seconds: None)

    result = weather_service.get_weather("Zone D")

    assert attempts["count"] == 2
    assert result["zone"] == "Zone D"
    assert result["trigger"] is None
