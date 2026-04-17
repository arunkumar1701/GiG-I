import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
os.environ["APP_ENV"] = "test"

import ai_engine


def test_calculate_premium_changes_with_income_and_context(monkeypatch):
    monkeypatch.setattr(ai_engine, "get_forecast_disruption_hours", lambda zone: 6.0 if zone == "Zone A" else 2.0)
    monkeypatch.setattr(
        ai_engine,
        "get_weather",
        lambda zone: {
            "trigger": "Heavy Rain" if zone == "Zone A" else None,
            "rain_mm_per_hr": 18.0 if zone == "Zone A" else 1.0,
            "temp_c": 38.0 if zone == "Zone A" else 31.0,
        },
    )
    monkeypatch.setattr(
        ai_engine,
        "get_aqi",
        lambda city: {"aqi": 120 if city == "Chennai" else 70, "category": "Moderate", "source": "test"},
    )
    monkeypatch.setattr(
        ai_engine,
        "predict_pricing_profile",
        lambda **kwargs: {
            "risk_score": 0.74 if kwargs["zone"] == "Zone A" else 0.38,
            "predicted_income_loss": 1600.0 if kwargs["zone"] == "Zone A" else 520.0,
        },
    )

    premium_high, _, _ = ai_engine.calculate_premium(
        weekly_income=6500.0,
        zone="Zone A",
        platform="Blinkit",
        vehicle_type="Scooter",
        city="Chennai",
    )
    premium_low, _, _ = ai_engine.calculate_premium(
        weekly_income=3500.0,
        zone="Zone C",
        platform="Swiggy",
        vehicle_type="Bike",
        city="Coimbatore",
    )

    assert premium_high > premium_low
    assert premium_high > 100


def test_ai_engine_auto_approves_low_risk_claim(monkeypatch):
    monkeypatch.setattr(
        ai_engine,
        "_run_gemini_tier3",
        lambda **kwargs: (kwargs["ml_context"]["fraud_probability"], "Model-native Tier-3 explanation.", []),
    )
    monkeypatch.setattr(
        ai_engine,
        "get_weather",
        lambda zone: {
            "trigger": "Heavy Rain",
            "rain_mm_per_hr": 8.2,
            "temp_c": 31.0,
        },
    )
    monkeypatch.setattr(
        ai_engine,
        "predict_claim_fraud_profile",
        lambda **kwargs: {
            "fraud_probability": 0.08,
            "predicted_income_loss": 420.0,
            "worker_risk_score": 0.32,
            "signal_scores": {
                "event": 0.04,
                "location": 0.06,
                "device": 0.05,
                "behavior": 0.10,
                "network": 0.05,
            },
            "graph_metrics": {"graph_risk": 0.07},
            "dataset_source": "test",
            "model_version": "test",
            "metrics": {},
        },
    )

    frs1, frs2, frs3, status, explanation, tx_id, logs, breakdown = ai_engine.evaluate_fraud_multipass(
        zone="Zone A",
        event_type="Heavy Rain",
        user_id=1,
        weekly_income=5000.0,
        payout_amount=450.0,
        claim_count_this_week=0,
        same_zone_claims_30min=1,
        geofence_distance_m=50.0,
    )

    assert frs1 < 0.1
    assert frs2 < 0.1
    assert frs3 == 0.08
    assert status == "Approved"
    assert tx_id == "PENDING_PAYOUT"
    assert breakdown["frs_event"] == 0.04
    assert any(log["step"] == "DECISION" for log in logs)
    assert "Approved" in explanation or "Auto-Approved" in explanation


def test_ai_engine_holds_mid_risk_claim(monkeypatch):
    monkeypatch.setattr(
        ai_engine,
        "_run_gemini_tier3",
        lambda **kwargs: (kwargs["ml_context"]["fraud_probability"], "Model-native Tier-3 explanation.", []),
    )
    monkeypatch.setattr(
        ai_engine,
        "get_weather",
        lambda zone: {
            "trigger": None,
            "rain_mm_per_hr": 0.0,
            "temp_c": 30.0,
        },
    )
    monkeypatch.setattr(
        ai_engine,
        "predict_claim_fraud_profile",
        lambda **kwargs: {
            "fraud_probability": 0.64,
            "predicted_income_loss": 1300.0,
            "worker_risk_score": 0.71,
            "signal_scores": {
                "event": 0.62,
                "location": 0.78,
                "device": 0.59,
                "behavior": 0.66,
                "network": 0.58,
            },
            "graph_metrics": {"graph_risk": 0.61},
            "dataset_source": "test",
            "model_version": "test",
            "metrics": {},
        },
    )

    _, _, _, status, explanation, tx_id, _, breakdown = ai_engine.evaluate_fraud_multipass(
        zone="Zone A",
        event_type="Heavy Rain",
        user_id=12,
        weekly_income=4000.0,
        payout_amount=2400.0,
        claim_count_this_week=4,
        same_zone_claims_30min=8,
    )

    assert status == "Hold"
    assert tx_id is None
    assert breakdown["frs_location"] >= 0.7
    assert "manual" in explanation.lower()


def test_ai_engine_rejects_when_hard_rejection_rule_is_met(monkeypatch):
    monkeypatch.setattr(
        ai_engine,
        "_run_gemini_tier3",
        lambda **kwargs: (kwargs["ml_context"]["fraud_probability"], "Model-native Tier-3 explanation.", []),
    )
    monkeypatch.setattr(
        ai_engine,
        "get_weather",
        lambda zone: {
            "trigger": None,
            "rain_mm_per_hr": 0.0,
            "temp_c": 29.0,
        },
    )
    monkeypatch.setattr(
        ai_engine,
        "predict_claim_fraud_profile",
        lambda **kwargs: {
            "fraud_probability": 0.91,
            "predicted_income_loss": 600.0,
            "worker_risk_score": 0.84,
            "signal_scores": {
                "event": 0.88,
                "location": 0.90,
                "device": 0.87,
                "behavior": 0.82,
                "network": 0.91,
            },
            "graph_metrics": {"graph_risk": 0.89},
            "dataset_source": "test",
            "model_version": "test",
            "metrics": {},
        },
    )

    _, _, _, status, explanation, tx_id, _, breakdown = ai_engine.evaluate_fraud_multipass(
        zone="Zone B",
        event_type="Heavy Rain",
        user_id=99,
        weekly_income=1200.0,
        payout_amount=1500.0,
        claim_count_this_week=6,
        same_zone_claims_30min=22,
    )

    assert status == "Rejected"
    assert tx_id is None
    assert breakdown["frs_location"] > 0.8
    assert breakdown["frs_device"] > 0.8
    assert breakdown["frs_network"] > 0.8
    assert "Auto-Rejected" in explanation


def test_ai_engine_repeat_claim_patterns_raise_frs(monkeypatch):
    monkeypatch.setattr(
        ai_engine,
        "_run_gemini_tier3",
        lambda **kwargs: (kwargs["ml_context"]["fraud_probability"], "Model-native Tier-3 explanation.", []),
    )
    monkeypatch.setattr(
        ai_engine,
        "get_weather",
        lambda zone: {
            "trigger": "Heavy Rain",
            "rain_mm_per_hr": 9.0,
            "temp_c": 30.0,
        },
    )
    monkeypatch.setattr(
        ai_engine,
        "predict_claim_fraud_profile",
        lambda **kwargs: {
            "fraud_probability": 0.21,
            "predicted_income_loss": 820.0,
            "worker_risk_score": 0.41,
            "signal_scores": {
                "event": 0.24,
                "location": 0.18,
                "device": 0.12,
                "behavior": 0.14,
                "network": 0.10,
            },
            "graph_metrics": {"graph_risk": 0.22},
            "dataset_source": "test",
            "model_version": "test",
            "metrics": {},
        },
    )

    _, _, frs_clean, _, _, _, _, _ = ai_engine.evaluate_fraud_multipass(
        zone="Zone A",
        event_type="Heavy Rain",
        user_id=4,
        weekly_income=5000.0,
        payout_amount=500.0,
        claim_count_this_week=0,
        same_zone_claims_30min=1,
    )
    _, _, frs_repeat, _, explanation, _, logs, _ = ai_engine.evaluate_fraud_multipass(
        zone="Zone A",
        event_type="Heavy Rain",
        user_id=4,
        weekly_income=5000.0,
        payout_amount=500.0,
        claim_count_this_week=3,
        same_zone_claims_30min=4,
        same_device_claims_24h=2,
        same_ip_claims_1h=2,
    )

    assert frs_repeat > frs_clean
    assert any(log["step"] == "CONTEXTUAL_RULES" for log in logs)
    assert "Claim Pattern Flags" in explanation
