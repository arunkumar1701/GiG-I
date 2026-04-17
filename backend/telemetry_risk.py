"""
telemetry_risk.py
-----------------
Pure functions for extracting GPS-based fraud signals from a worker's shift telemetry.
These signals are injected into the ML fusion model at claim time.

Signal design rationale:
  - continuity_score   : Genuine workers have regular pings. Gaps = GPS disabled = suspicious.
  - speed_risk         : >120 km/h on a bike = GPS spoofing or mocked location.
  - gps_stale_risk     : If last ping is >5 min before trigger → worker may not have been present.
  - accuracy_risk      : Very poor GPS accuracy (>100m) = location trust is low.
  - distance_norm      : Normalised km traveled during shift (evidence of physical presence).
"""
from __future__ import annotations

import datetime
import math
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────
SPEED_SPOOF_THRESHOLD_KMH  = 120.0   # Physically impossible for a Bike/Scooter
STALE_GPS_THRESHOLD_MIN    = 5       # Last ping older than this = stale
POOR_ACCURACY_THRESHOLD_M  = 80.0    # >80m accuracy = location not trusted
NORMAL_PING_INTERVAL_S     = 30      # Expected ping every 30 s
MAX_CONTINUITY_GAP_S       = 120     # Gaps >2 min count as breaks
MAX_SHIFT_DISTANCE_KM      = 150.0   # Normalisation ceiling


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return Haversine distance in metres between two GPS points."""
    r = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2) ** 2
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def distance_traveled_km(pings: list[dict]) -> float:
    """Sum of Haversine distances across consecutive pings (in km)."""
    if len(pings) < 2:
        return 0.0
    total = 0.0
    for i in range(1, len(pings)):
        total += _haversine_m(
            pings[i - 1]["lat"], pings[i - 1]["lon"],
            pings[i]["lat"],     pings[i]["lon"],
        )
    return round(total / 1000.0, 3)


def max_speed_kmh(pings: list[dict]) -> float:
    """
    Returns the peak speed value across all pings.
    Uses browser-reported speed_kmh if available; falls back to haversine-derived speed.
    """
    if not pings:
        return 0.0

    peak = 0.0
    for p in pings:
        # Prefer browser-reported speed
        if p.get("speed_kmh") is not None:
            peak = max(peak, float(p["speed_kmh"]))
        # Compute from consecutive haversine if only coordinates available
    if len(pings) >= 2:
        for i in range(1, len(pings)):
            dist_m = _haversine_m(
                pings[i - 1]["lat"], pings[i - 1]["lon"],
                pings[i]["lat"],     pings[i]["lon"],
            )
            t1 = pings[i - 1]["timestamp"]
            t2 = pings[i]["timestamp"]
            if isinstance(t1, str):
                t1 = datetime.datetime.fromisoformat(t1)
            if isinstance(t2, str):
                t2 = datetime.datetime.fromisoformat(t2)
            dt_s = max((t2 - t1).total_seconds(), 1.0)
            derived_kmh = (dist_m / dt_s) * 3.6
            peak = max(peak, derived_kmh)

    return round(peak, 2)


def is_gps_stale(last_ping_ts: datetime.datetime | None, threshold_minutes: int = STALE_GPS_THRESHOLD_MIN) -> bool:
    """Returns True if the last GPS ping is older than `threshold_minutes`."""
    if last_ping_ts is None:
        return True
    age = (datetime.datetime.utcnow() - last_ping_ts).total_seconds() / 60.0
    return age > threshold_minutes


def mean_accuracy_m(pings: list[dict]) -> float:
    """Average GPS accuracy in metres across pings that reported it."""
    values = [float(p["accuracy_m"]) for p in pings if p.get("accuracy_m") is not None]
    return round(sum(values) / len(values), 1) if values else POOR_ACCURACY_THRESHOLD_M


def continuity_score(pings: list[dict], expected_interval_s: int = NORMAL_PING_INTERVAL_S) -> float:
    """
    Score 0-1 measuring how continuous the GPS stream was.
    1.0 = perfectly regular pings; 0.0 = large gaps / almost no pings.
    """
    if len(pings) < 2:
        return 0.3  # Only 1 ping = low confidence (not zero — could be fresh shift)

    gap_penalties = 0.0
    for i in range(1, len(pings)):
        t1 = pings[i - 1]["timestamp"]
        t2 = pings[i]["timestamp"]
        if isinstance(t1, str):
            t1 = datetime.datetime.fromisoformat(t1)
        if isinstance(t2, str):
            t2 = datetime.datetime.fromisoformat(t2)
        gap_s = max((t2 - t1).total_seconds(), 0.0)
        if gap_s > MAX_CONTINUITY_GAP_S:
            # Penalty proportional to the overshoot
            gap_penalties += min((gap_s - expected_interval_s) / (10 * expected_interval_s), 1.0)

    raw = max(0.0, 1.0 - (gap_penalties / max(len(pings) - 1, 1)))
    return round(raw, 4)


def speed_risk_score(pings: list[dict]) -> float:
    """
    0-1 risk score based on maximum observed speed.
    >120 km/h on a gig-worker bike = GPS spoofing indicator.
    """
    peak = max_speed_kmh(pings)
    if peak < 60.0:
        return 0.0
    if peak >= SPEED_SPOOF_THRESHOLD_KMH:
        return 1.0
    return round((peak - 60.0) / (SPEED_SPOOF_THRESHOLD_KMH - 60.0), 4)


def accuracy_risk_score(pings: list[dict]) -> float:
    """
    0-1 risk: high = GPS accuracy is poor (location unreliable).
    0 = perfect (<10m), 1 = terrible (>100m).
    """
    avg = mean_accuracy_m(pings)
    if avg <= 10.0:
        return 0.0
    if avg >= POOR_ACCURACY_THRESHOLD_M:
        return 1.0
    return round((avg - 10.0) / (POOR_ACCURACY_THRESHOLD_M - 10.0), 4)


def gps_stale_risk(last_ping_at: datetime.datetime | None) -> float:
    """
    0-1 risk for stale GPS. Returns 1.0 if no pings at all.
    Graduated: 0 if fresh, 1 if >15 min stale.
    """
    if last_ping_at is None:
        return 1.0
    age_min = (datetime.datetime.utcnow() - last_ping_at).total_seconds() / 60.0
    if age_min <= STALE_GPS_THRESHOLD_MIN:
        return 0.0
    if age_min >= 15.0:
        return 1.0
    return round((age_min - STALE_GPS_THRESHOLD_MIN) / (15.0 - STALE_GPS_THRESHOLD_MIN), 4)


def build_telemetry_evidence(shift, pings: list[Any]) -> dict:
    """
    Given a WorkerShift ORM object and its pings (as dicts or ORM rows),
    compute all telemetry fraud signals and return a normalized dict
    ready for injection into the ML pipeline.

    Args:
        shift: WorkerShift ORM row (or None)
        pings: list of TelemetryPing ORM rows (or plain dicts)

    Returns:
        dict with keys: telemetry_continuity, telemetry_speed_risk,
                        telemetry_gps_stale, telemetry_accuracy_risk,
                        telemetry_distance_km, telemetry_ping_count,
                        shift_active
    """
    if shift is None:
        logger.warning("[Telemetry] No active shift — returning max-risk evidence.")
        return {
            "telemetry_continuity":    0.0,
            "telemetry_speed_risk":    1.0,
            "telemetry_gps_stale":     1.0,
            "telemetry_accuracy_risk": 1.0,
            "telemetry_distance_km":   0.0,
            "telemetry_ping_count":    0,
            "shift_active":            False,
        }

    # Convert ORM rows to dicts
    ping_dicts: list[dict] = []
    for p in pings:
        if isinstance(p, dict):
            ping_dicts.append(p)
        else:
            ping_dicts.append({
                "lat":        p.lat,
                "lon":        p.lon,
                "accuracy_m": p.accuracy_m,
                "speed_kmh":  p.speed_kmh,
                "heading":    p.heading,
                "timestamp":  p.timestamp,
            })

    last_ping_at = getattr(shift, "last_ping_at", None)

    continuity   = continuity_score(ping_dicts)
    spd_risk     = speed_risk_score(ping_dicts)
    stale_risk   = gps_stale_risk(last_ping_at)
    acc_risk     = accuracy_risk_score(ping_dicts)
    dist_km      = distance_traveled_km(ping_dicts)
    dist_norm    = min(dist_km / MAX_SHIFT_DISTANCE_KM, 1.0)

    return {
        "telemetry_continuity":    round(continuity, 4),
        "telemetry_speed_risk":    round(spd_risk, 4),
        "telemetry_gps_stale":     round(stale_risk, 4),
        "telemetry_accuracy_risk": round(acc_risk, 4),
        "telemetry_distance_km":   round(dist_km, 3),
        "telemetry_distance_norm": round(dist_norm, 4),
        "telemetry_ping_count":    len(ping_dicts),
        "shift_active":            bool(getattr(shift, "is_active", False)),
    }
