"""
GiG-I fraud scoring and pricing engine.

Pricing:
- XGBoost worker risk score
- Gradient Boosting loss estimate

Fraud scoring:
- Five trained fraud-signal models: event, location, device, behavior, network
- Trained fusion model for the final FRS
- README decision policy bands on top of model outputs
- Gemini is used only for contextual explanation, not for score generation
"""

from __future__ import annotations

import json
import logging
from typing import Optional

import google.generativeai as genai

from aqi_service import aqi_to_premium_multiplier, get_aqi
from ml_pipeline import predict_claim_fraud_profile, predict_pricing_profile
from settings import settings
from weather_service import get_forecast_disruption_hours, get_weather

logger = logging.getLogger(__name__)

GEMINI_API_KEY = settings.gemini_api_key

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    _gemini_model = genai.GenerativeModel("gemini-1.5-flash")
    logger.info("[AI Engine] Gemini LLM initialized successfully.")
else:
    _gemini_model = None
    logger.warning("[AI Engine] No Gemini API key - Tier-3 explanation will stay model-native.")


def _bounded(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return float(max(low, min(high, value)))


def _normalize_event_name(event_type: str) -> str:
    normalized = event_type.strip().lower()
    aliases = {
        "heavy rain": "heavy rain",
        "flood alert": "flood alert",
        "flood": "flood alert",
        "heatwave": "heatwave",
        "urban shutdown": "urban shutdown",
        "curfew": "urban shutdown",
    }
    return aliases.get(normalized, normalized)


def calculate_premium(
    weekly_income: float,
    zone: str,
    platform: str = "Swiggy",
    vehicle_type: str = "Bike",
    city: Optional[str] = None,
) -> tuple[float, list[str], float]:
    factors: list[str] = []
    city_name = city or zone.replace("Zone ", "Chennai ")

    forecast_hours = get_forecast_disruption_hours(zone)
    live_weather = get_weather(zone)
    aqi_data = get_aqi(city_name)
    pricing_profile = predict_pricing_profile(
        weekly_income=weekly_income,
        zone=zone,
        platform=platform,
        vehicle_type=vehicle_type,
        forecast_hours=forecast_hours,
        aqi=aqi_data["aqi"],
    )

    risk_score = pricing_profile["risk_score"]
    predicted_loss = pricing_profile["predicted_income_loss"]
    base_rate_component = weekly_income * 0.05 * max(risk_score, 0.35)
    coverage_component = predicted_loss * 0.08
    aqi_multiplier = aqi_to_premium_multiplier(aqi_data["aqi"])
    final_premium = round((base_rate_component + coverage_component) * aqi_multiplier, 2)

    factors.append(f"XGBoost worker risk score: {risk_score:.2f}")
    factors.append(f"Gradient Boosting predicted disruption loss: INR {predicted_loss:.2f}")
    factors.append(f"7-day forecast disruption window: {forecast_hours:.1f}h")
    factors.append(
        f"AQI adjustment ({aqi_data['aqi']} / {aqi_data['category']} / {aqi_data['source']}): x{aqi_multiplier:.2f}"
    )
    factors.append(
        f"Live weather snapshot: rain {live_weather.get('rain_mm_per_hr', 0.0):.1f}mm/hr, "
        f"temp {live_weather.get('temp_c', 30.0):.1f}C"
    )
    return final_premium, factors, round(forecast_hours, 1)


def evaluate_fraud_multipass(
    zone: str,
    event_type: str,
    user_id: int,
    weekly_income: float,
    payout_amount: float,
    claim_count_this_week: int,
    same_zone_claims_30min: int,
    geofence_distance_m: Optional[float] = None,
    same_device_claims_24h: int = 0,
    same_ip_claims_1h: int = 0,
    same_upi_claims_24h: int = 0,
    device_integrity_score: float = 0.0,
    cluster_flagged: bool = False,
    telemetry: Optional[dict] = None,     # Phase 3: GPS evidence dict
    db_session=None,
) -> tuple:
    logs = [{"step": "INIT", "message": "Starting pure-ML README fraud evaluation pipeline."}]

    try:
        live_weather = get_weather(zone)
        rain_mm = float(live_weather.get("rain_mm_per_hr", 0.0) or 0.0)
        temp_c = float(live_weather.get("temp_c", 30.0) or 30.0)
        actual_trigger = _normalize_event_name(live_weather.get("trigger") or "")
        requested_trigger = _normalize_event_name(event_type)
        event_match = 1.0 if actual_trigger and actual_trigger == requested_trigger else 0.0
        trigger_present = 1.0 if actual_trigger else 0.0
        logs.append(
            {
                "step": "EVENT_CONTEXT",
                "message": (
                    f"Live context for {zone}: trigger={live_weather.get('trigger')}, rain={rain_mm:.1f}mm/hr, "
                    f"temp={temp_c:.1f}C, event_match={event_match:.0f}."
                ),
            }
        )
    except Exception as exc:
        logger.error("[AI Engine] Live context fetch failed: %s", exc)
        raise RuntimeError("Fraud pipeline requires live event context to score claims") from exc

    telem = telemetry or {}
    shift_active = telem.get("shift_active", None)  # None = unknown (legacy path)

    # ── Hard Rule: No active shift = instant rejection ─────────────────────────
    if shift_active is False:
        hard_reject_explanation = (
            "Auto-Rejected: No active GPS shift at trigger time. "
            "Worker was not online when the weather event occurred. "
            "Claims require an active shift with GPS consent."
        )
        logs.append({"step": "SHIFT_CHECK", "message": "No active shift — hard rejection applied."})
        signal_breakdown = {
            "frs_location": 1.0, "frs_device": 0.0,
            "frs_behavior": 0.0, "frs_network": 0.0, "frs_event": 1.0,
        }
        return 1.0, 1.0, 1.0, "Rejected", hard_reject_explanation, None, logs, signal_breakdown

    ml_profile = predict_claim_fraud_profile(
        zone=zone,
        event_type=event_type,
        user_id=user_id,
        weekly_income=weekly_income,
        payout_amount=payout_amount,
        claim_count_this_week=claim_count_this_week,
        same_zone_claims_30min=same_zone_claims_30min,
        geofence_distance_m=geofence_distance_m,
        same_device_claims_24h=same_device_claims_24h,
        same_ip_claims_1h=same_ip_claims_1h,
        same_upi_claims_24h=same_upi_claims_24h,
        device_integrity_score=device_integrity_score,
        cluster_flagged=cluster_flagged,
        rain_mm=rain_mm,
        temp_c=temp_c,
        event_match=event_match,
        trigger_present=trigger_present,
        telemetry=telem,
    )
    logs.append(
        {
            "step": "ML_PIPELINE",
            "message": (
                f"Pure ML fraud pipeline {ml_profile['model_version']} | source={ml_profile['dataset_source']} | "
                f"fusion_frs={ml_profile['fraud_probability']:.3f} | graph_risk={ml_profile['graph_metrics']['graph_risk']:.3f}"
            ),
        }
    )

    signal_scores = ml_profile["signal_scores"]
    sig_event = round(signal_scores["event"], 3)
    sig_location = round(signal_scores["location"], 3)
    sig_device = round(signal_scores["device"], 3)
    sig_behavior = round(signal_scores["behavior"], 3)
    sig_network = round(signal_scores["network"], 3)

    frs1 = round((sig_event + sig_location) / 2.0, 3)
    frs2 = round((sig_device + sig_behavior + sig_network) / 3.0, 3)
    frs3, tier3_explanation, tier3_logs = _run_gemini_tier3(
        zone=zone,
        event_type=event_type,
        weekly_income=weekly_income,
        payout_amount=payout_amount,
        frs1=frs1,
        frs2=frs2,
        sig_location=sig_location,
        sig_device=sig_device,
        sig_behavior=sig_behavior,
        sig_network=sig_network,
        sig_event=sig_event,
        rain_mm=rain_mm,
        temp_c=temp_c,
        ml_context=ml_profile,
        telemetry=telem,
    )
    logs.extend(tier3_logs)

    # ── Hard-Rule Post-Model Signal Boosts ──────────────────────────────────────
    # These rules override ML score upward when GPS evidence is unambiguous.
    hard_boost = 0.0
    hard_rule_notes = []

    gps_stale = telem.get("telemetry_gps_stale", None)
    speed_risk = telem.get("telemetry_speed_risk", None)
    continuity = telem.get("telemetry_continuity", None)
    ping_count = telem.get("telemetry_ping_count", None)

    if gps_stale is not None and float(gps_stale) >= 0.8:
        boost = 0.12
        hard_boost += boost
        hard_rule_notes.append(f"GPS stale risk={gps_stale:.2f} (+{boost} FRS boost: location presence unverified).")
        logs.append({"step": "HARD_RULE_GPS_STALE", "message": hard_rule_notes[-1]})

    if speed_risk is not None and float(speed_risk) >= 0.9:
        boost = 0.15
        hard_boost += boost
        hard_rule_notes.append(f"Speed anomaly risk={speed_risk:.2f} (+{boost} FRS boost: GPS spoofing suspected).")
        logs.append({"step": "HARD_RULE_SPEED", "message": hard_rule_notes[-1]})

    if continuity is not None and float(continuity) < 0.2:
        boost = 0.10
        hard_boost += boost
        hard_rule_notes.append(f"GPS continuity={continuity:.2f} (+{boost} FRS boost: large tracking gaps).")
        logs.append({"step": "HARD_RULE_CONTINUITY", "message": hard_rule_notes[-1]})

    if ping_count is not None and int(ping_count) == 0:
        boost = 0.20
        hard_boost += boost
        hard_rule_notes.append(f"Zero GPS pings recorded (+{boost} FRS boost: no tracking evidence).")
        logs.append({"step": "HARD_RULE_NO_PINGS", "message": hard_rule_notes[-1]})

    if hard_boost > 0:
        original_frs3 = frs3
        frs3 = round(min(frs3 + hard_boost, 1.0), 3)
        logs.append({
            "step": "HARD_RULE_APPLIED",
            "message": f"Hard rules boosted FRS from {original_frs3} to {frs3}. Rules: {'; '.join(hard_rule_notes)}"
        })
        if hard_rule_notes:
            tier3_explanation = f"[GPS Evidence Flags] {' '.join(hard_rule_notes)} Original model score: {original_frs3}. " + tier3_explanation

    strong_signals = sum(1 for score in [sig_location, sig_device, sig_behavior, sig_network, sig_event] if score > 0.8)

    if frs3 > 0.85 and strong_signals >= 2:
        status = "Rejected"
        explanation = (
            f"Auto-Rejected: FRS={frs3}. Hard rejection rule met with {strong_signals} independent anomalies. "
            f"{tier3_explanation}"
        )
        tx_id = None
    elif frs3 >= 0.75:
        status = "Hold"
        explanation = f"Held for manual audit. FRS={frs3}. README hold threshold reached. {tier3_explanation}"
        tx_id = None
    elif frs3 >= 0.55:
        status = "Hold"
        explanation = (
            f"Delayed payout + secondary validation with manual review. FRS={frs3}. "
            f"README secondary validation band reached. {tier3_explanation}"
        )
        tx_id = None
    elif frs3 >= 0.25:
        status = "Approved"
        explanation = f"Approved with silent monitoring. FRS={frs3}. {tier3_explanation}"
        tx_id = "PENDING_PAYOUT"
    else:
        status = "Approved"
        explanation = f"Auto-Approved. FRS={frs3}. {tier3_explanation}"
        tx_id = "PENDING_PAYOUT"

    logs.append({"step": "FRS1_CHECK", "message": f"Tier-1 model composite FRS1={frs1}."})
    logs.append({"step": "FRS2_SCAN", "message": f"Tier-2 model composite FRS2={frs2}."})
    logs.append({"step": "DECISION", "message": f"Policy decision={status} with FRS={frs3}."})

    signal_breakdown = {
        "frs_location": sig_location,
        "frs_device": sig_device,
        "frs_behavior": sig_behavior,
        "frs_network": sig_network,
        "frs_event": sig_event,
    }
    return frs1, frs2, frs3, status, explanation, tx_id, logs, signal_breakdown


def _run_gemini_tier3(
    zone,
    event_type,
    weekly_income,
    payout_amount,
    frs1,
    frs2,
    sig_location,
    sig_device,
    sig_behavior,
    sig_network,
    sig_event,
    rain_mm,
    temp_c,
    ml_context: Optional[dict] = None,
    telemetry: Optional[dict] = None,
) -> tuple:
    logs = []
    ml_context = ml_context or {}
    graph_metrics = ml_context.get("graph_metrics", {})
    frs3 = round(float(ml_context.get("fraud_probability", 0.0)), 3)

    if not _gemini_model:
        explanation = (
            f"Tier-3 final FRS comes from the trained fusion model. "
            f"Graph risk={graph_metrics.get('graph_risk', 0.0):.2f}, predicted loss=INR {ml_context.get('predicted_income_loss', 0.0):.2f}."
        )
        logs.append({"step": "FRS3_AGENT", "message": f"Model-native Tier-3 FRS3={frs3}."})
        return frs3, explanation, logs

    telem = telemetry or {}
    telem_lines = ""
    if telem:
        telem_lines = f"""

GPS TELEMETRY EVIDENCE:
- Shift Active: {telem.get('shift_active', 'unknown')}
- Ping Count: {telem.get('telemetry_ping_count', 'unknown')}
- GPS Continuity Score: {telem.get('telemetry_continuity', 'unknown')} (1=continuous, 0=gap-filled)
- Speed Anomaly Risk: {telem.get('telemetry_speed_risk', 'unknown')} (1=spoofing suspected)
- GPS Stale Risk: {telem.get('telemetry_gps_stale', 'unknown')} (1=GPS disappeared)
- Accuracy Risk: {telem.get('telemetry_accuracy_risk', 'unknown')} (1=very inaccurate)
- Distance Traveled: {telem.get('telemetry_distance_km', 'unknown')} km"""

    prompt = f"""You are the Tier-3 explanation agent for GiG-I.

Do not change the final fraud score. The final FRS is fixed at {frs3} from the trained fusion model.
Explain the model result in one concise sentence.

CLAIM CONTEXT:
- Zone: {zone}
- Event Type: {event_type}
- Weekly Income: INR {weekly_income}
- Claimed Payout: INR {payout_amount}
- Verified Rain: {rain_mm} mm/hr
- Verified Temperature: {temp_c} C

MODEL SIGNALS:
- Event: {sig_event}
- Location: {sig_location}
- Device: {sig_device}
- Behavior: {sig_behavior}
- Network: {sig_network}
- Tier-1 composite: {frs1}
- Tier-2 composite: {frs2}
- Graph risk: {graph_metrics.get('graph_risk', 0.0)}{telem_lines}

Respond ONLY with valid JSON:
{{
  "explanation": "One concise sentence.",
  "agent_log": "One concise sentence."
}}"""

    try:
        response = _gemini_model.generate_content(prompt)
        raw_text = response.text.strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        parsed = json.loads(raw_text)
        explanation = parsed.get("explanation", "Tier-3 explanation complete.")
        agent_log = parsed.get("agent_log", "Gemini explanation complete.")
        logs.append({"step": "FRS3_AGENT", "message": f"Gemini explanation attached for FRS3={frs3}. {agent_log}"})
        return frs3, explanation, logs
    except Exception as exc:
        logger.error("[AI Engine] Gemini Tier-3 explanation failed: %s", exc)
        explanation = (
            f"Tier-3 final FRS comes from the trained fusion model. "
            f"Graph risk={graph_metrics.get('graph_risk', 0.0):.2f}, predicted loss=INR {ml_context.get('predicted_income_loss', 0.0):.2f}."
        )
        logs.append({"step": "FRS3_AGENT", "message": f"Gemini explanation failed; retained fusion-model FRS3={frs3}."})
        return frs3, explanation, logs
