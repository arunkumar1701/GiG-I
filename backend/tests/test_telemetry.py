"""
tests/test_telemetry.py
------------------------
Unit tests for the telemetry_risk fraud signal helpers.
Run with: python -m pytest backend/tests/ -v
"""
import datetime
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest
from telemetry_risk import (
    continuity_score,
    distance_traveled_km,
    gps_stale_risk,
    accuracy_risk_score,
    speed_risk_score,
    build_telemetry_evidence,
)

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _now():
    return datetime.datetime.utcnow()

def _ping(lat, lon, offset_seconds=0, accuracy=15, speed_kmh=20, heading=90):
    """Create a synthetic ping dict."""
    return {
        "lat": lat,
        "lon": lon,
        "accuracy_m": accuracy,
        "speed_kmh": speed_kmh,
        "heading": heading,
        "timestamp": _now() - datetime.timedelta(seconds=offset_seconds),
    }


# ─────────────────────────────────────────────────────────────────────────────
# distance_traveled_km
# ─────────────────────────────────────────────────────────────────────────────

class TestDistanceTraveled:
    def test_zero_pings(self):
        assert distance_traveled_km([]) == 0.0

    def test_one_ping(self):
        # Only 1 ping = 0 distance
        assert distance_traveled_km([_ping(13.08, 80.27)]) == 0.0

    def test_same_location(self):
        pings = [_ping(13.08, 80.27), _ping(13.08, 80.27)]
        assert distance_traveled_km(pings) == 0.0

    def test_known_distance(self):
        # ~1.1 km apart (Chennai area)
        pings = [_ping(13.0827, 80.2707), _ping(13.0904, 80.2810)]
        dist = distance_traveled_km(pings)
        assert 0.9 < dist < 1.5, f"Expected ~1.1km, got {dist}"

    def test_multiple_pings(self):
        pings = [
            _ping(13.0827, 80.2707, 120),
            _ping(13.0842, 80.2732, 90),
            _ping(13.0861, 80.2765, 60),
            _ping(13.0880, 80.2782, 30),
            _ping(13.0904, 80.2810, 0),
        ]
        dist = distance_traveled_km(pings)
        assert dist > 0.5, "Expected non-trivial distance"
        assert dist < 5.0, "Expected reasonable distance"


# ─────────────────────────────────────────────────────────────────────────────
# gps_stale_risk
# ─────────────────────────────────────────────────────────────────────────────

class TestGpsStaleRisk:
    def test_no_ping(self):
        assert gps_stale_risk(None) == 1.0

    def test_fresh_ping(self):
        # Ping 1 minute ago → should be 0
        ts = _now() - datetime.timedelta(minutes=1)
        score = gps_stale_risk(ts)
        assert score == 0.0, f"Expected 0.0 for fresh GPS, got {score}"

    def test_stale_ping(self):
        # Ping 20 minutes ago → should be 1.0
        ts = _now() - datetime.timedelta(minutes=20)
        score = gps_stale_risk(ts)
        assert score == 1.0, f"Expected 1.0 for stale GPS, got {score}"

    def test_graduated_staleness(self):
        # Ping exactly on the boundary (5 min) → 0
        ts_boundary = _now() - datetime.timedelta(minutes=5)
        assert gps_stale_risk(ts_boundary) == 0.0

        # Ping 10 minutes ago → between 0 and 1
        ts_middle = _now() - datetime.timedelta(minutes=10)
        score = gps_stale_risk(ts_middle)
        assert 0.0 < score < 1.0, f"Expected mid-range staleness, got {score}"


# ─────────────────────────────────────────────────────────────────────────────
# speed_risk_score
# ─────────────────────────────────────────────────────────────────────────────

class TestSpeedRisk:
    def test_zero_speed(self):
        pings = [_ping(13.08, 80.27, speed_kmh=0)]
        assert speed_risk_score(pings) == 0.0

    def test_normal_bike_speed(self):
        pings = [_ping(13.08, 80.27, speed_kmh=30)]
        assert speed_risk_score(pings) == 0.0

    def test_high_speed_flag(self):
        # 150 km/h = GPS spoofing → risk 1.0
        pings = [_ping(13.08, 80.27, speed_kmh=150, offset_seconds=0),
                 _ping(13.08, 80.27, speed_kmh=150, offset_seconds=30)]
        score = speed_risk_score(pings)
        assert score >= 1.0, f"Expected 1.0 for >120 km/h, got {score}"

    def test_graduated_speed(self):
        # 90 km/h — between 60 and 120 = some risk
        pings = [_ping(13.08, 80.27, speed_kmh=90)]
        score = speed_risk_score(pings)
        assert 0.0 < score < 1.0, f"Expected mid-range speed risk, got {score}"

    def test_borderline_speed_exact_threshold(self):
        pings = [_ping(13.08, 80.27, speed_kmh=120)]
        assert speed_risk_score(pings) == 1.0

    def test_plausible_highway_speed_stays_below_max(self):
        pings = [_ping(13.08, 80.27, speed_kmh=115)]
        score = speed_risk_score(pings)
        assert 0.0 < score < 1.0


# ─────────────────────────────────────────────────────────────────────────────
# accuracy_risk_score
# ─────────────────────────────────────────────────────────────────────────────

class TestAccuracyRisk:
    def test_excellent_accuracy(self):
        pings = [_ping(13.08, 80.27, accuracy=5)]
        assert accuracy_risk_score(pings) == 0.0

    def test_poor_accuracy(self):
        pings = [_ping(13.08, 80.27, accuracy=200)]
        assert accuracy_risk_score(pings) == 1.0

    def test_no_accuracy_info(self):
        pings = [{"lat": 13.08, "lon": 80.27, "timestamp": _now()}]
        # Default = POOR_ACCURACY_THRESHOLD_M (80m) → risk 1.0
        score = accuracy_risk_score(pings)
        assert score == 1.0


# ─────────────────────────────────────────────────────────────────────────────
# continuity_score
# ─────────────────────────────────────────────────────────────────────────────

class TestContinuityScore:
    def test_empty(self):
        score = continuity_score([])
        assert score == 0.3  # Only 0-1 pings = low confidence

    def test_one_ping(self):
        assert continuity_score([_ping(13.08, 80.27)]) == 0.3

    def test_regular_pings_high_score(self):
        # 10 pings each 30s apart → perfect continuity
        pings = [_ping(13.08, 80.27, offset_seconds=i * 30) for i in range(9, -1, -1)]
        score = continuity_score(pings)
        assert score >= 0.9, f"Expected high continuity, got {score}"

    def test_large_gap_lowers_score(self):
        # One 10-minute gap in the middle
        pings = [
            _ping(13.08, 80.27, offset_seconds=600),  # 10 min ago
            _ping(13.09, 80.28, offset_seconds=0),     # now (10-min gap)
        ]
        score = continuity_score(pings)
        assert score < 0.9, f"Expected lower continuity due to gap, got {score}"

    def test_gap_just_under_threshold_preserves_continuity(self):
        pings = [
            _ping(13.08, 80.27, offset_seconds=119),
            _ping(13.0805, 80.2705, offset_seconds=0),
        ]
        score = continuity_score(pings)
        assert score >= 0.9, f"Expected near-clean continuity for 119s gap, got {score}"

    def test_gap_over_threshold_penalizes_continuity(self):
        pings = [
            _ping(13.08, 80.27, offset_seconds=121),
            _ping(13.0805, 80.2705, offset_seconds=0),
        ]
        score = continuity_score(pings)
        assert score < 0.95, f"Expected penalty once gap crosses 120s, got {score}"


# ─────────────────────────────────────────────────────────────────────────────
# build_telemetry_evidence
# ─────────────────────────────────────────────────────────────────────────────

class TestBuildTelemetryEvidence:
    def test_no_shift_returns_max_risk(self):
        evidence = build_telemetry_evidence(None, [])
        assert evidence["telemetry_gps_stale"] == 1.0
        assert evidence["telemetry_speed_risk"] == 1.0
        assert evidence["shift_active"] is False
        assert evidence["telemetry_ping_count"] == 0

    def test_good_telemetry_returns_low_risk(self):
        class FakeShift:
            is_active = True
            last_ping_at = _now() - datetime.timedelta(seconds=30)

        pings = [
            _ping(13.0827, 80.2707, 120, accuracy=10, speed_kmh=25),
            _ping(13.0842, 80.2732, 90,  accuracy=12, speed_kmh=28),
            _ping(13.0861, 80.2765, 60,  accuracy=8,  speed_kmh=22),
            _ping(13.0880, 80.2782, 30,  accuracy=11, speed_kmh=30),
            _ping(13.0904, 80.2810, 0,   accuracy=9,  speed_kmh=25),
        ]
        evidence = build_telemetry_evidence(FakeShift(), pings)
        assert evidence["shift_active"] is True
        assert evidence["telemetry_ping_count"] == 5
        assert evidence["telemetry_continuity"] >= 0.8, "Good pings should have high continuity"
        assert evidence["telemetry_speed_risk"] == 0.0, "Normal speed = no risk"
        assert evidence["telemetry_gps_stale"] == 0.0, "Recent ping = not stale"
        assert evidence["telemetry_accuracy_risk"] == 0.0, "Good accuracy = low risk"
        assert evidence["telemetry_distance_km"] > 0

    def test_suspicious_telemetry_returns_high_risk(self):
        class FakeStalShift:
            is_active = True
            last_ping_at = _now() - datetime.timedelta(minutes=20)  # Very stale

        pings = [
            _ping(13.08, 80.27, 1200, accuracy=200, speed_kmh=180),  # 20 min ago, terrible accuracy, impossible speed
        ]
        evidence = build_telemetry_evidence(FakeStalShift(), pings)
        assert evidence["telemetry_gps_stale"] == 1.0
        assert evidence["telemetry_speed_risk"] == 1.0
        assert evidence["telemetry_accuracy_risk"] == 1.0

    def test_teleportation_jump_hits_speed_anomaly(self):
        class FakeShift:
            is_active = True
            last_ping_at = _now()

        pings = [
            _ping(13.0827, 80.2707, offset_seconds=240, accuracy=10, speed_kmh=None),
            _ping(13.1547, 80.2707, offset_seconds=0, accuracy=12, speed_kmh=None),
        ]
        evidence = build_telemetry_evidence(FakeShift(), pings)
        assert evidence["telemetry_speed_risk"] >= 1.0
