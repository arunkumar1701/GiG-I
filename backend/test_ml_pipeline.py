import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
os.environ["APP_ENV"] = "test"

from ml_pipeline import predict_claim_fraud_profile, predict_pricing_profile


def test_ml_pipeline_bootstraps_and_scores():
    pricing = predict_pricing_profile(
        weekly_income=5200.0,
        zone="Zone A",
        platform="Swiggy",
        vehicle_type="Bike",
        forecast_hours=6.0,
        aqi=180,
    )
    assert 0.0 <= pricing["risk_score"] <= 1.0
    assert pricing["predicted_income_loss"] > 0.0
    assert pricing["model_version"]

    fraud = predict_claim_fraud_profile(
        zone="Zone A",
        event_type="Heavy Rain",
        user_id=101,
        weekly_income=5200.0,
        payout_amount=650.0,
        claim_count_this_week=1,
        same_zone_claims_30min=3,
        geofence_distance_m=80.0,
        same_device_claims_24h=0,
        same_ip_claims_1h=0,
        same_upi_claims_24h=0,
        device_integrity_score=0.02,
        cluster_flagged=False,
        rain_mm=7.5,
        temp_c=30.0,
        event_match=1.0,
        trigger_present=1.0,
    )
    assert 0.0 <= fraud["fraud_probability"] <= 1.0
    assert fraud["predicted_income_loss"] > 0.0
    assert 0.0 <= fraud["graph_metrics"]["graph_risk"] <= 1.0
    assert set(fraud["signal_scores"]) == {"event", "location", "device", "behavior", "network"}
    assert fraud["dataset_source"]
