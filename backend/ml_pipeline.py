"""
ml_pipeline.py
--------------
Trained ML bootstrap and inference helpers for GiG-I.

This module aligns the fraud path to the README architecture:
- XGBoost worker risk scoring for pricing
- Gradient Boosting Regression for income-loss estimation
- XGBoost per-signal fraud models for event, location, device, behavior, network
- XGBoost fusion model for the final FRS
- Graph analytics features for coordinated attack detection
"""

from __future__ import annotations

import datetime as dt
import logging
from pathlib import Path
from typing import Any

import joblib
import networkx as nx
import numpy as np
import pandas as pd
from sklearn.datasets import fetch_openml
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, roc_auc_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor

from settings import settings

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
ARTIFACT_DIR = BASE_DIR / "model_artifacts"
BUNDLE_PATH = ARTIFACT_DIR / "gig_i_ml_bundle.joblib"
MODEL_VERSION = "2026.04.16-ml-frs-pure"
RNG_SEED = 42

ZONE_RISK = {
    "Zone A": 0.82,
    "Zone B": 0.58,
    "Zone C": 0.31,
    "Zone D": 0.44,
}
EVENT_SEVERITY = {
    "Heavy Rain": 0.66,
    "Flood Alert": 0.94,
    "Flood": 0.94,
    "Heatwave": 0.61,
    "Urban Shutdown": 0.89,
    "Curfew": 0.89,
}
VEHICLE_RISK = {
    "Bike": 0.62,
    "Scooter": 0.56,
    "EV": 0.47,
    "Cycle": 0.35,
}
PLATFORM_FACTOR = {
    "Swiggy": 0.58,
    "Zomato": 0.52,
    "Blinkit": 0.63,
}

PRICING_FEATURES = [
    "zone_risk",
    "seasonality_index",
    "vehicle_risk",
    "platform_factor",
    "weather_intensity",
    "forecast_disruption_norm",
    "aqi_norm",
    "weekly_income_norm",
    "historical_consistency",
]

LOSS_FEATURES = [
    "zone_risk",
    "seasonality_index",
    "vehicle_risk",
    "platform_factor",
    "weather_intensity",
    "forecast_disruption_norm",
    "aqi_norm",
    "weekly_income_norm",
    "historical_consistency",
    "event_severity",
]

EVENT_SIGNAL_FEATURES = [
    "zone_risk",
    "seasonality_index",
    "event_severity",
    "event_match",
    "trigger_present",
    "weather_intensity",
    "aqi_norm",
    "public_anomaly_index",
]

LOCATION_SIGNAL_FEATURES = [
    "zone_risk",
    "event_match",
    "trigger_present",
    "geofence_norm",
    "same_zone_claims_norm",
    "weather_intensity",
    "public_anomaly_index",
]

DEVICE_SIGNAL_FEATURES = [
    "claim_count_week_norm",
    "same_device_norm",
    "device_integrity_score",
    "historical_consistency",
    "shared_identifier_score",
    "public_anomaly_index",
]

BEHAVIOR_SIGNAL_FEATURES = [
    "weekly_income_norm",
    "payout_ratio",
    "predicted_loss_gap",
    "historical_consistency",
    "event_severity",
    "weather_intensity",
    "public_amount_norm",
]

NETWORK_SIGNAL_FEATURES = [
    "same_zone_claims_norm",
    "same_ip_norm",
    "same_upi_norm",
    "graph_density",
    "graph_cluster_score",
    "graph_degree_centrality",
    "shared_identifier_score",
]

FUSION_FEATURES = [
    "event_signal_score",
    "location_signal_score",
    "device_signal_score",
    "behavior_signal_score",
    "network_signal_score",
    "worker_risk_score",
    "predicted_loss_gap",
    "public_anomaly_index",
]

_MODEL_BUNDLE: dict[str, Any] | None = None


def _bounded(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return float(max(low, min(high, value)))


def _normalize_signal(value: Any, cap: float) -> Any:
    if cap <= 0:
        return 0.0 if np.isscalar(value) else np.zeros_like(value, dtype=float)
    values = np.asarray(value, dtype=float) / cap
    clipped = np.clip(values, 0.0, 1.0)
    if np.isscalar(value):
        return float(clipped)
    return clipped


def _normalize_series(values: Any) -> np.ndarray:
    series = np.asarray(values, dtype=float)
    spread = max(float(series.max()) - float(series.min()), 1e-9)
    return (series - float(series.min())) / spread


def _zone_risk(zone: str) -> float:
    return ZONE_RISK.get(zone, 0.5)


def _event_severity(event_type: str) -> float:
    return EVENT_SEVERITY.get(event_type, 0.52)


def _vehicle_risk(vehicle_type: str) -> float:
    return VEHICLE_RISK.get(vehicle_type, 0.56)


def _platform_factor(platform: str) -> float:
    return PLATFORM_FACTOR.get(platform, 0.55)


def _seasonality_index(month: int) -> float:
    if month in {6, 7, 8, 9}:
        return 0.92
    if month in {4, 5}:
        return 0.74
    if month in {10, 11}:
        return 0.58
    return 0.42


def _make_regressor() -> XGBRegressor:
    return XGBRegressor(
        n_estimators=140,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        reg_lambda=1.0,
        random_state=RNG_SEED,
        objective="reg:squarederror",
        tree_method="hist",
    )


def _load_public_fraud_seed() -> tuple[pd.DataFrame | None, str]:
    if settings.app_env in {"test", "testing"}:
        return None, "synthetic-test-bootstrap"

    openml_cache_dir = ARTIFACT_DIR / "openml_cache"
    openml_cache_dir.mkdir(parents=True, exist_ok=True)
    candidates = [
        {"data_id": 1597},
        {"data_id": 42397},
        {"name": "creditcard", "version": 1},
    ]
    for candidate in candidates:
        try:
            dataset = fetch_openml(
                as_frame=True,
                parser="auto",
                cache=True,
                data_home=str(openml_cache_dir),
                **candidate,
            )
            frame = dataset.frame.copy() if getattr(dataset, "frame", None) is not None else None
            if frame is None:
                frame = pd.DataFrame(dataset.data)
                frame["target"] = dataset.target

            target_col = "Class" if "Class" in frame.columns else "target"
            labels = frame[target_col].astype(int).reset_index(drop=True)
            feature_cols = [column for column in frame.columns if column != target_col]
            numeric = frame[feature_cols].select_dtypes(include=["number"]).reset_index(drop=True)
            if numeric.empty:
                raise ValueError("OpenML fraud seed dataset did not expose numeric features")

            anomaly_index = numeric.abs().mean(axis=1)
            amount_series = numeric["Amount"] if "Amount" in numeric.columns else anomaly_index
            time_series = numeric["Time"] if "Time" in numeric.columns else np.arange(len(numeric))
            public_seed = pd.DataFrame(
                {
                    "public_label": labels.to_numpy(dtype=int),
                    "public_amount_norm": _normalize_series(amount_series),
                    "public_time_norm": _normalize_series(time_series),
                    "public_anomaly_index": _normalize_series(anomaly_index),
                }
            )
            return public_seed, f"openml:{candidate}"
        except Exception as exc:
            logger.warning("[MLPipeline] Failed to load public fraud dataset %s: %s", candidate, exc)

    return None, "synthetic-fallback-bootstrap"


def _build_training_frame(rows: int = 5000) -> tuple[pd.DataFrame, str]:
    rng = np.random.default_rng(RNG_SEED)
    public_seed, dataset_source = _load_public_fraud_seed()

    if public_seed is not None:
        public = public_seed.sample(n=rows, replace=True, random_state=RNG_SEED).reset_index(drop=True)
        public_label = public["public_label"].to_numpy(dtype=int)
        public_amount_norm = public["public_amount_norm"].to_numpy(dtype=float)
        public_anomaly_index = public["public_anomaly_index"].to_numpy(dtype=float)
    else:
        public_label = rng.choice([0, 1], size=rows, p=[0.82, 0.18])
        public_amount_norm = rng.random(rows)
        public_anomaly_index = rng.random(rows)

    zones = rng.choice(["Zone A", "Zone B", "Zone C", "Zone D"], size=rows, p=[0.32, 0.27, 0.20, 0.21])
    events = rng.choice(
        ["Heavy Rain", "Flood Alert", "Heatwave", "Urban Shutdown"],
        size=rows,
        p=[0.46, 0.18, 0.24, 0.12],
    )
    vehicles = rng.choice(["Bike", "Scooter", "EV", "Cycle"], size=rows, p=[0.54, 0.22, 0.16, 0.08])
    platforms = rng.choice(["Swiggy", "Zomato", "Blinkit"], size=rows, p=[0.43, 0.37, 0.20])
    months = rng.integers(1, 13, size=rows)

    zone_risk = np.array([_zone_risk(zone) for zone in zones])
    event_severity = np.array([_event_severity(event) for event in events])
    vehicle_risk = np.array([_vehicle_risk(vehicle) for vehicle in vehicles])
    platform_factor = np.array([_platform_factor(platform) for platform in platforms])
    seasonality_index = np.array([_seasonality_index(month) for month in months])

    weekly_income = np.clip(rng.normal(5800, 1800, rows), 1800.0, 16000.0)
    weekly_income_norm = _normalize_signal(weekly_income, 16000.0)
    forecast_hours = np.clip(
        1.5 + (event_severity * 9.0) + (seasonality_index * 2.5) + rng.normal(0.0, 1.1, rows),
        0.0,
        14.0,
    )
    forecast_disruption_norm = _normalize_signal(forecast_hours, 14.0)
    aqi = np.clip(rng.normal(165, 55, rows), 50.0, 420.0)
    aqi_norm = _normalize_signal(aqi, 420.0)
    weather_intensity = np.clip(
        (event_severity * 0.62) + (forecast_disruption_norm * 0.25) + rng.normal(0.0, 0.06, rows),
        0.0,
        1.0,
    )

    historical_consistency = np.clip(
        np.where(
            public_label == 1,
            rng.normal(0.35 - (public_anomaly_index * 0.10), 0.10, rows),
            rng.normal(0.82, 0.08, rows),
        ),
        0.0,
        1.0,
    )
    event_match = np.clip(
        np.where(public_label == 1, rng.binomial(1, 0.28, rows), rng.binomial(1, 0.92, rows)),
        0.0,
        1.0,
    )
    trigger_present = np.clip(
        np.where(public_label == 1, rng.binomial(1, 0.42, rows), rng.binomial(1, 0.95, rows)),
        0.0,
        1.0,
    )
    geofence_distance_m = np.clip(
        np.where(
            public_label == 1,
            rng.gamma(4.2, 215.0, rows) + (public_anomaly_index * 700.0),
            rng.gamma(1.4, 30.0, rows),
        ),
        0.0,
        5000.0,
    )
    geofence_norm = _normalize_signal(geofence_distance_m, 2500.0)
    claim_count_week = np.clip(
        np.where(public_label == 1, rng.poisson(4.4, rows), rng.poisson(1.1, rows)),
        0.0,
        12.0,
    )
    claim_count_week_norm = _normalize_signal(claim_count_week, 6.0)
    same_zone_claims_30min = np.clip(
        np.where(public_label == 1, rng.poisson(10.2, rows), rng.poisson(3.1, rows)),
        0.0,
        40.0,
    )
    same_zone_claims_norm = _normalize_signal(same_zone_claims_30min, 18.0)
    same_device_claims_24h = np.clip(
        np.where(public_label == 1, rng.poisson(2.8, rows), rng.poisson(0.25, rows)),
        0.0,
        10.0,
    )
    same_ip_claims_1h = np.clip(
        np.where(public_label == 1, rng.poisson(2.1, rows), rng.poisson(0.20, rows)),
        0.0,
        10.0,
    )
    same_upi_claims_24h = np.clip(
        np.where(public_label == 1, rng.poisson(1.3, rows), rng.poisson(0.10, rows)),
        0.0,
        6.0,
    )
    same_device_norm = _normalize_signal(same_device_claims_24h, 4.0)
    same_ip_norm = _normalize_signal(same_ip_claims_1h, 4.0)
    same_upi_norm = _normalize_signal(same_upi_claims_24h, 3.0)
    device_integrity_score = np.clip(
        np.where(
            public_label == 1,
            rng.normal(0.76 + (public_anomaly_index * 0.12), 0.10, rows),
            rng.normal(0.12, 0.08, rows),
        ),
        0.0,
        1.0,
    )
    shared_identifier_score = np.clip(
        (same_device_norm * 0.40) + (same_ip_norm * 0.35) + (same_upi_norm * 0.25),
        0.0,
        1.0,
    )
    graph_density = np.clip(
        (shared_identifier_score * 0.52) + (same_zone_claims_norm * 0.28) + rng.normal(0.0, 0.04, rows),
        0.0,
        1.0,
    )
    graph_cluster_score = np.clip(
        (graph_density * 0.55) + (same_ip_norm * 0.25) + (same_upi_norm * 0.20),
        0.0,
        1.0,
    )
    graph_degree_centrality = np.clip(
        (same_device_norm * 0.35) + (same_ip_norm * 0.35) + (same_upi_norm * 0.15) + (graph_density * 0.15),
        0.0,
        1.0,
    )

    risk_score_target = np.clip(
        (zone_risk * 0.24)
        + (seasonality_index * 0.20)
        + (vehicle_risk * 0.14)
        + (platform_factor * 0.08)
        + (forecast_disruption_norm * 0.16)
        + (aqi_norm * 0.10)
        + ((1.0 - historical_consistency) * 0.08)
        + rng.normal(0.0, 0.02, rows),
        0.0,
        1.0,
    )
    income_loss_target = np.clip(
        weekly_income
        * (
            0.05
            + (event_severity * 0.22)
            + (forecast_disruption_norm * 0.10)
            + (zone_risk * 0.05)
            + (aqi_norm * 0.04)
        )
        * (0.92 + (platform_factor * 0.12))
        + rng.normal(0.0, 85.0, rows),
        120.0,
        weekly_income * 1.35,
    )
    claimed_payout = np.clip(
        np.where(
            public_label == 1,
            income_loss_target * (1.16 + (public_amount_norm * 0.60)),
            income_loss_target * (0.84 + (rng.random(rows) * 0.18)),
        ),
        80.0,
        weekly_income * 1.75,
    )
    payout_ratio = np.clip(claimed_payout / np.maximum(weekly_income, 1.0), 0.0, 2.0)
    predicted_loss_gap = np.clip(
        np.abs(claimed_payout - income_loss_target) / np.maximum(weekly_income, 1.0),
        0.0,
        1.0,
    )

    event_signal_score = np.clip(
        ((1.0 - event_match) * 0.48)
        + ((1.0 - trigger_present) * 0.24)
        + (public_anomaly_index * 0.12)
        + (zone_risk * 0.06)
        + ((1.0 - historical_consistency) * 0.10),
        0.0,
        1.0,
    )
    location_signal_score = np.clip(
        (geofence_norm * 0.65)
        + ((1.0 - event_match) * 0.05)
        + (same_zone_claims_norm * 0.10)
        + (public_anomaly_index * 0.20),
        0.0,
        1.0,
    )
    device_signal_score = np.clip(
        (device_integrity_score * 0.46)
        + (same_device_norm * 0.18)
        + (claim_count_week_norm * 0.14)
        + (shared_identifier_score * 0.12)
        + ((1.0 - historical_consistency) * 0.10),
        0.0,
        1.0,
    )
    behavior_signal_score = np.clip(
        (payout_ratio * 0.30)
        + (predicted_loss_gap * 0.48)
        + ((1.0 - historical_consistency) * 0.14)
        + (public_amount_norm * 0.08),
        0.0,
        1.0,
    )
    network_signal_score = np.clip(
        (same_zone_claims_norm * 0.08)
        + (same_ip_norm * 0.18)
        + (same_upi_norm * 0.18)
        + (graph_density * 0.18)
        + (graph_cluster_score * 0.18)
        + (graph_degree_centrality * 0.10)
        + (shared_identifier_score * 0.10),
        0.0,
        1.0,
    )
    fraud_score_target = np.clip(
        (event_signal_score * 0.20)
        + (location_signal_score * 0.20)
        + (device_signal_score * 0.20)
        + (behavior_signal_score * 0.20)
        + (network_signal_score * 0.20)
        + (public_label * 0.06)
        + (public_anomaly_index * 0.04),
        0.0,
        1.0,
    )
    fraud_label = (fraud_score_target >= 0.58).astype(int)

    frame = pd.DataFrame(
        {
            "zone_risk": zone_risk,
            "seasonality_index": seasonality_index,
            "vehicle_risk": vehicle_risk,
            "platform_factor": platform_factor,
            "event_severity": event_severity,
            "event_match": event_match,
            "trigger_present": trigger_present,
            "weather_intensity": weather_intensity,
            "forecast_disruption_norm": forecast_disruption_norm,
            "aqi_norm": aqi_norm,
            "weekly_income_norm": weekly_income_norm,
            "payout_ratio": payout_ratio,
            "claim_count_week_norm": claim_count_week_norm,
            "same_zone_claims_norm": same_zone_claims_norm,
            "geofence_norm": geofence_norm,
            "same_device_norm": same_device_norm,
            "same_ip_norm": same_ip_norm,
            "same_upi_norm": same_upi_norm,
            "device_integrity_score": device_integrity_score,
            "historical_consistency": historical_consistency,
            "graph_density": graph_density,
            "graph_cluster_score": graph_cluster_score,
            "graph_degree_centrality": graph_degree_centrality,
            "shared_identifier_score": shared_identifier_score,
            "predicted_loss_gap": predicted_loss_gap,
            "worker_risk_score": risk_score_target,
            "public_amount_norm": public_amount_norm,
            "public_anomaly_index": public_anomaly_index,
            "risk_score_target": risk_score_target,
            "income_loss_target": income_loss_target,
            "event_signal_score": event_signal_score,
            "location_signal_score": location_signal_score,
            "device_signal_score": device_signal_score,
            "behavior_signal_score": behavior_signal_score,
            "network_signal_score": network_signal_score,
            "fraud_score_target": fraud_score_target,
            "fraud_label": fraud_label,
        }
    )
    return frame, dataset_source


def _evaluate_signal_model(model: XGBRegressor, x_test: pd.DataFrame, y_test: pd.Series, fraud_label: pd.Series) -> tuple[float, float]:
    predictions = np.clip(model.predict(x_test), 0.0, 1.0)
    mae = mean_absolute_error(y_test, predictions)
    auc = 0.5 if fraud_label.nunique() < 2 else roc_auc_score(fraud_label, predictions)
    return float(mae), float(auc)


def _train_models() -> dict[str, Any]:
    frame, dataset_source = _build_training_frame()

    pricing_x_train, pricing_x_test, pricing_y_train, pricing_y_test = train_test_split(
        frame[PRICING_FEATURES],
        frame["risk_score_target"],
        test_size=0.2,
        random_state=RNG_SEED,
    )
    loss_x_train, loss_x_test, loss_y_train, loss_y_test = train_test_split(
        frame[LOSS_FEATURES],
        frame["income_loss_target"],
        test_size=0.2,
        random_state=RNG_SEED,
    )

    pricing_model = _make_regressor()
    loss_model = GradientBoostingRegressor(
        random_state=RNG_SEED,
        n_estimators=180,
        learning_rate=0.05,
        max_depth=3,
    )
    pricing_model.fit(pricing_x_train, pricing_y_train)
    loss_model.fit(loss_x_train, loss_y_train)

    signal_specs = {
        "event_model": (EVENT_SIGNAL_FEATURES, "event_signal_score"),
        "location_model": (LOCATION_SIGNAL_FEATURES, "location_signal_score"),
        "device_model": (DEVICE_SIGNAL_FEATURES, "device_signal_score"),
        "behavior_model": (BEHAVIOR_SIGNAL_FEATURES, "behavior_signal_score"),
        "network_model": (NETWORK_SIGNAL_FEATURES, "network_signal_score"),
    }

    signal_models: dict[str, XGBRegressor] = {}
    signal_metrics: dict[str, dict[str, float]] = {}
    for model_name, (feature_names, target_name) in signal_specs.items():
        x_train, x_test, y_train, y_test = train_test_split(
            frame[feature_names],
            frame[target_name],
            test_size=0.2,
            random_state=RNG_SEED,
        )
        model = _make_regressor()
        model.fit(x_train, y_train)
        signal_models[model_name] = model
        mae, auc = _evaluate_signal_model(model, x_test, y_test, frame.loc[x_test.index, "fraud_label"])
        signal_metrics[model_name] = {"mae": mae, "auc": auc}

    fusion_x_train, fusion_x_test, fusion_y_train, fusion_y_test = train_test_split(
        frame[FUSION_FEATURES],
        frame["fraud_score_target"],
        test_size=0.2,
        random_state=RNG_SEED,
    )
    fusion_model = _make_regressor()
    fusion_model.fit(fusion_x_train, fusion_y_train)
    fusion_predictions = np.clip(fusion_model.predict(fusion_x_test), 0.0, 1.0)
    fraud_labels = frame.loc[fusion_x_test.index, "fraud_label"]
    fraud_auc = 0.5 if fraud_labels.nunique() < 2 else roc_auc_score(fraud_labels, fusion_predictions)
    fusion_mae = mean_absolute_error(fusion_y_test, fusion_predictions)

    pricing_mae = mean_absolute_error(pricing_y_test, pricing_model.predict(pricing_x_test))
    loss_mae = mean_absolute_error(loss_y_test, loss_model.predict(loss_x_test))

    logger.info(
        "[MLPipeline] Trained pure-ML fraud models from %s | fusion_auc=%.3f fusion_mae=%.3f",
        dataset_source,
        fraud_auc,
        fusion_mae,
    )

    return {
        "version": MODEL_VERSION,
        "dataset_source": dataset_source,
        "trained_at": dt.datetime.utcnow().isoformat() + "Z",
        "pricing_model": pricing_model,
        "loss_model": loss_model,
        "event_model": signal_models["event_model"],
        "location_model": signal_models["location_model"],
        "device_model": signal_models["device_model"],
        "behavior_model": signal_models["behavior_model"],
        "network_model": signal_models["network_model"],
        "fusion_model": fusion_model,
        "pricing_features": PRICING_FEATURES,
        "loss_features": LOSS_FEATURES,
        "event_features": EVENT_SIGNAL_FEATURES,
        "location_features": LOCATION_SIGNAL_FEATURES,
        "device_features": DEVICE_SIGNAL_FEATURES,
        "behavior_features": BEHAVIOR_SIGNAL_FEATURES,
        "network_features": NETWORK_SIGNAL_FEATURES,
        "fusion_features": FUSION_FEATURES,
        "metrics": {
            "fraud_auc": float(fraud_auc),
            "fusion_mae": float(fusion_mae),
            "pricing_mae": float(pricing_mae),
            "loss_mae": float(loss_mae),
            "rows": int(len(frame)),
            **signal_metrics,
        },
    }


def get_model_bundle(force_retrain: bool = False) -> dict[str, Any]:
    global _MODEL_BUNDLE
    if _MODEL_BUNDLE is not None and not force_retrain:
        return _MODEL_BUNDLE

    if not force_retrain and BUNDLE_PATH.exists():
        try:
            loaded = joblib.load(BUNDLE_PATH)
            if loaded.get("version") == MODEL_VERSION:
                _MODEL_BUNDLE = loaded
                return loaded
        except Exception as exc:
            logger.warning("[MLPipeline] Failed to load cached model bundle: %s", exc)

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    bundle = _train_models()
    joblib.dump(bundle, BUNDLE_PATH)
    _MODEL_BUNDLE = bundle
    return bundle


def build_claim_graph(
    *,
    user_id: int,
    zone: str,
    same_device_claims_24h: int,
    same_ip_claims_1h: int,
    same_upi_claims_24h: int,
    same_zone_claims_30min: int,
    cluster_flagged: bool,
) -> tuple[nx.Graph, dict[str, float]]:
    graph = nx.Graph()
    worker_node = f"worker:{user_id}"
    zone_node = f"zone:{zone}"
    graph.add_node(worker_node, kind="worker")
    graph.add_node(zone_node, kind="zone")
    graph.add_edge(worker_node, zone_node, weight=max(1, same_zone_claims_30min))

    if same_device_claims_24h:
        node = f"device:{same_device_claims_24h}"
        graph.add_node(node, kind="device")
        graph.add_edge(worker_node, node, weight=max(1, same_device_claims_24h))
    if same_ip_claims_1h:
        node = f"ip:{same_ip_claims_1h}"
        graph.add_node(node, kind="ip")
        graph.add_edge(worker_node, node, weight=max(1, same_ip_claims_1h))
    if same_upi_claims_24h:
        node = f"upi:{same_upi_claims_24h}"
        graph.add_node(node, kind="upi")
        graph.add_edge(worker_node, node, weight=max(1, same_upi_claims_24h))
    if cluster_flagged:
        graph.add_node("cluster:flagged", kind="cluster")
        graph.add_edge(worker_node, "cluster:flagged", weight=3)

    density = nx.density(graph) if graph.number_of_nodes() > 1 else 0.0
    degree_centrality = nx.degree_centrality(graph).get(worker_node, 0.0)
    cluster_score = nx.average_clustering(graph) if graph.number_of_nodes() > 2 else 0.0
    shared_identifier_score = _bounded(
        (same_device_claims_24h / 4.0 * 0.40)
        + (same_ip_claims_1h / 4.0 * 0.35)
        + (same_upi_claims_24h / 3.0 * 0.25)
        + (0.10 if cluster_flagged else 0.0)
    )
    graph_risk = _bounded(
        (density * 0.25)
        + (degree_centrality * 0.20)
        + (cluster_score * 0.20)
        + (shared_identifier_score * 0.35)
    )
    return graph, {
        "density": float(density),
        "degree_centrality": float(degree_centrality),
        "cluster_score": float(cluster_score),
        "shared_identifier_score": float(shared_identifier_score),
        "graph_risk": float(graph_risk),
        "nodes": float(graph.number_of_nodes()),
        "edges": float(graph.number_of_edges()),
    }


def predict_pricing_profile(
    *,
    weekly_income: float,
    zone: str,
    platform: str = "Swiggy",
    vehicle_type: str = "Bike",
    forecast_hours: float = 0.0,
    aqi: int = 150,
    timestamp: dt.datetime | None = None,
    historical_consistency: float = 0.78,
) -> dict[str, Any]:
    bundle = get_model_bundle()
    now = timestamp or dt.datetime.utcnow()
    frame = pd.DataFrame(
        [
            {
                "zone_risk": _zone_risk(zone),
                "seasonality_index": _seasonality_index(now.month),
                "vehicle_risk": _vehicle_risk(vehicle_type),
                "platform_factor": _platform_factor(platform),
                "weather_intensity": _bounded((forecast_hours / 12.0) * 0.75),
                "forecast_disruption_norm": _normalize_signal(forecast_hours, 14.0),
                "aqi_norm": _normalize_signal(float(aqi), 420.0),
                "weekly_income_norm": _normalize_signal(float(weekly_income), 16000.0),
                "historical_consistency": _bounded(historical_consistency),
                "event_severity": 0.52,
            }
        ]
    )

    risk_score = _bounded(float(bundle["pricing_model"].predict(frame[bundle["pricing_features"]])[0]))
    predicted_income_loss = max(0.0, float(bundle["loss_model"].predict(frame[bundle["loss_features"]])[0]))
    return {
        "risk_score": risk_score,
        "predicted_income_loss": predicted_income_loss,
        "dataset_source": bundle["dataset_source"],
        "model_version": bundle["version"],
        "metrics": bundle["metrics"],
    }


def predict_claim_fraud_profile(
    *,
    zone: str,
    event_type: str,
    user_id: int,
    weekly_income: float,
    payout_amount: float,
    claim_count_this_week: int,
    same_zone_claims_30min: int,
    geofence_distance_m: float | None,
    same_device_claims_24h: int,
    same_ip_claims_1h: int,
    same_upi_claims_24h: int,
    device_integrity_score: float,
    cluster_flagged: bool,
    rain_mm: float,
    temp_c: float,
    event_match: float,
    trigger_present: float,
    platform: str = "Swiggy",
    vehicle_type: str = "Bike",
) -> dict[str, Any]:
    bundle = get_model_bundle()
    _, graph_metrics = build_claim_graph(
        user_id=user_id,
        zone=zone,
        same_device_claims_24h=same_device_claims_24h,
        same_ip_claims_1h=same_ip_claims_1h,
        same_upi_claims_24h=same_upi_claims_24h,
        same_zone_claims_30min=same_zone_claims_30min,
        cluster_flagged=cluster_flagged,
    )

    seasonality_index = _seasonality_index(dt.datetime.utcnow().month)
    weather_intensity = _bounded(max(rain_mm / 8.0, temp_c / 45.0) * 0.45 + (_event_severity(event_type) * 0.55))
    historical_consistency = _bounded(1.0 - (claim_count_this_week / 8.0))
    pricing_profile = predict_pricing_profile(
        weekly_income=weekly_income,
        zone=zone,
        platform=platform,
        vehicle_type=vehicle_type,
        forecast_hours=max(rain_mm, 0.0),
        aqi=150,
        historical_consistency=historical_consistency,
    )
    predicted_loss = pricing_profile["predicted_income_loss"]
    payout_ratio = _bounded(float(payout_amount) / max(float(weekly_income), 1.0), 0.0, 2.0)
    predicted_loss_gap = _bounded(abs(float(payout_amount) - predicted_loss) / max(float(weekly_income), 1.0))

    base_features = {
        "zone_risk": _zone_risk(zone),
        "seasonality_index": seasonality_index,
        "event_severity": _event_severity(event_type),
        "event_match": _bounded(event_match),
        "trigger_present": _bounded(trigger_present),
        "weather_intensity": weather_intensity,
        "aqi_norm": _normalize_signal(150.0, 420.0),
        "weekly_income_norm": _normalize_signal(float(weekly_income), 16000.0),
        "payout_ratio": payout_ratio,
        "claim_count_week_norm": _normalize_signal(float(claim_count_this_week), 6.0),
        "same_zone_claims_norm": _normalize_signal(float(same_zone_claims_30min), 18.0),
        "geofence_norm": _normalize_signal(float(geofence_distance_m or 1000.0), 2500.0),
        "same_device_norm": _normalize_signal(float(same_device_claims_24h), 4.0),
        "same_ip_norm": _normalize_signal(float(same_ip_claims_1h), 4.0),
        "same_upi_norm": _normalize_signal(float(same_upi_claims_24h), 3.0),
        "device_integrity_score": _bounded(float(device_integrity_score)),
        "historical_consistency": historical_consistency,
        "graph_density": graph_metrics["density"],
        "graph_cluster_score": graph_metrics["cluster_score"],
        "graph_degree_centrality": graph_metrics["degree_centrality"],
        "shared_identifier_score": graph_metrics["shared_identifier_score"],
        "predicted_loss_gap": predicted_loss_gap,
        "public_amount_norm": payout_ratio * 0.5,
        "public_anomaly_index": _bounded(graph_metrics["graph_risk"] * 0.55 + (1.0 - event_match) * 0.45),
    }

    event_frame = pd.DataFrame([{name: base_features[name] for name in bundle["event_features"]}])
    location_frame = pd.DataFrame([{name: base_features[name] for name in bundle["location_features"]}])
    device_frame = pd.DataFrame([{name: base_features[name] for name in bundle["device_features"]}])
    behavior_frame = pd.DataFrame([{name: base_features[name] for name in bundle["behavior_features"]}])
    network_frame = pd.DataFrame([{name: base_features[name] for name in bundle["network_features"]}])

    event_signal = _bounded(float(bundle["event_model"].predict(event_frame)[0]))
    location_signal = _bounded(float(bundle["location_model"].predict(location_frame)[0]))
    device_signal = _bounded(float(bundle["device_model"].predict(device_frame)[0]))
    behavior_signal = _bounded(float(bundle["behavior_model"].predict(behavior_frame)[0]))
    network_signal = _bounded(float(bundle["network_model"].predict(network_frame)[0]))

    fusion_frame = pd.DataFrame(
        [
            {
                "event_signal_score": event_signal,
                "location_signal_score": location_signal,
                "device_signal_score": device_signal,
                "behavior_signal_score": behavior_signal,
                "network_signal_score": network_signal,
                "worker_risk_score": pricing_profile["risk_score"],
                "predicted_loss_gap": predicted_loss_gap,
                "public_anomaly_index": base_features["public_anomaly_index"],
            }
        ]
    )
    fraud_probability = _bounded(float(bundle["fusion_model"].predict(fusion_frame[bundle["fusion_features"]])[0]))

    return {
        "fraud_probability": fraud_probability,
        "predicted_income_loss": predicted_loss,
        "worker_risk_score": pricing_profile["risk_score"],
        "signal_scores": {
            "event": event_signal,
            "location": location_signal,
            "device": device_signal,
            "behavior": behavior_signal,
            "network": network_signal,
        },
        "graph_metrics": graph_metrics,
        "dataset_source": bundle["dataset_source"],
        "model_version": bundle["version"],
        "metrics": bundle["metrics"],
    }
