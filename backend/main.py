"""
main.py
-------
GiG-I Parametric Insurance — FastAPI Backend
Phase 2 MVP: Real APIs, Multi-Signal Fraud Engine, APScheduler Auto-Monitoring
"""

import asyncio
import json
import logging
import datetime
import hmac
import math
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator
from typing import Any, Optional
from apscheduler.schedulers.background import BackgroundScheduler

import models
import schemas
from database import engine, get_db, SessionLocal
from ai_engine import calculate_premium, evaluate_fraud_multipass
from weather_service import get_weather, ZONE_COORDS
from payout_service import initiate_payout
from metrics_service import record_claim_metrics
from otp_service import otp_service
from telemetry_risk import build_telemetry_evidence
from prisma_client import (
    connect_prisma,
    disconnect_prisma,
    get_prisma_dependency,
    prisma_enabled,
)
from prisma_repository import (
    check_zone_payout_cap_prisma,
    count_recent_claims_for_driver,
    count_recent_hash_activity,
    count_weekly_claims_for_driver,
    create_claim_event_with_wallet_tx,
    get_active_policies_for_driver,
    ledger_view,
    wallet_view,
)
from settings import settings
from security import (
    create_token_pair,
    encrypt_secret,
    get_auth_context,
    get_security_posture,
    hash_identifier,
    hash_claim_data,
    mask_phone,
    rate_limit_check,
    require_admin,
    decode_refresh_token,
    verify_admin_credentials,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if not prisma_enabled():
    models.Base.metadata.create_all(bind=engine)


def _ensure_runtime_schema() -> None:
    """Backfill SQLite columns needed by the evolving MVP schema."""
    inspector = inspect(engine)
    with engine.begin() as conn:
        if "users" in inspector.get_table_names():
            user_columns = {column["name"] for column in inspector.get_columns("users")}
            if "vehicle_type" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN vehicle_type VARCHAR"))
            if "vehicle_number" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN vehicle_number VARCHAR"))
            if "shift_status" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN shift_status VARCHAR"))
            if "phone_hash" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN phone_hash VARCHAR"))
            if "phone_encrypted" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN phone_encrypted VARCHAR"))
            if "upi_hash" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN upi_hash VARCHAR"))
            if "upi_encrypted" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN upi_encrypted VARCHAR"))
            if "bank_name" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN bank_name VARCHAR"))
            if "bank_account_last4" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN bank_account_last4 VARCHAR"))
            if "bank_account_hash" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN bank_account_hash VARCHAR"))
            if "bank_account_encrypted" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN bank_account_encrypted VARCHAR"))
            if "ifsc_hash" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN ifsc_hash VARCHAR"))
            if "ifsc_encrypted" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN ifsc_encrypted VARCHAR"))
            if "emergency_contact" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN emergency_contact VARCHAR"))
            if "emergency_contact_hash" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN emergency_contact_hash VARCHAR"))
            if "emergency_contact_encrypted" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN emergency_contact_encrypted VARCHAR"))

        if "claims" in inspector.get_table_names():
            existing_columns = {column["name"] for column in inspector.get_columns("claims")}
            additions = {
                "data_hash": "VARCHAR",
                "driver_lat": "FLOAT",
                "driver_lon": "FLOAT",
                "device_hash": "VARCHAR",
                "ip_address_hash": "VARCHAR",
                "upi_hash": "VARCHAR",
                "token_id": "INTEGER",
                "cluster_flagged": "BOOLEAN",
            }
            for column_name, column_type in additions.items():
                if column_name not in existing_columns:
                    conn.execute(text(f"ALTER TABLE claims ADD COLUMN {column_name} {column_type}"))


if not prisma_enabled():
    models.Base.metadata.create_all(bind=engine)
    _ensure_runtime_schema()


def _backfill_phase3_schema() -> None:
    """Add Phase-3 columns (shift/telemetry) to existing SQLite DBs."""
    if prisma_enabled():
        return
    inspector = inspect(engine)
    with engine.begin() as conn:
        tables = inspector.get_table_names()
        # worker_shifts and telemetry_pings are created by SQLAlchemy if not exist
        if "claims" in tables:
            existing = {c["name"] for c in inspector.get_columns("claims")}
            additions = {
                "shift_id": "INTEGER",
                "telemetry_continuity": "FLOAT",
                "telemetry_speed_risk": "FLOAT",
                "telemetry_gps_stale": "FLOAT",
                "telemetry_accuracy_risk": "FLOAT",
                "telemetry_distance_km": "FLOAT",
                "telemetry_ping_count": "INTEGER",
            }
            for col, typ in additions.items():
                if col not in existing:
                    conn.execute(text(f"ALTER TABLE claims ADD COLUMN {col} {typ}"))


_backfill_phase3_schema()

# ---------------------------------------------------------------------------
# Monitor State (shared across scheduler and API)
# ---------------------------------------------------------------------------
monitor_state = {
    "last_run": None,
    "last_triggers": [],
    "total_auto_claims": 0,
}

ALL_ZONES = ["Zone A", "Zone B", "Zone C", "Zone D"]
CORS_ALLOW_ORIGINS = settings.cors_allow_origins
ALLOWED_HOSTS = settings.allowed_hosts
APP_ENV = settings.app_env
OTP_CODE_TTL_SECONDS = 300


def _serialize_sensor_payload(
    *,
    location: Optional[dict] = None,
    weather_snapshot: Optional[dict] = None,
    driver_id: Optional[int] = None,
) -> str:
    payload = {}
    if driver_id is not None:
        payload["driver_id"] = driver_id
    if location:
        payload["location"] = location
    if weather_snapshot:
        payload["weather_snapshot"] = weather_snapshot
    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def _attach_claim_hash(
    claim: models.Claim,
    *,
    zone: str,
    event_type: str,
    location: Optional[dict] = None,
    weather_snapshot: Optional[dict] = None,
    driver_id: Optional[int] = None,
) -> None:
    sensor_payload = _serialize_sensor_payload(
        location=location,
        weather_snapshot=weather_snapshot,
        driver_id=driver_id,
    )
    claim.data_hash = hash_claim_data(
        claim.id,
        zone,
        event_type,
        claim.timestamp.isoformat(),
        sensor_payload=sensor_payload,
    )


def _authorize_user_scope(current_auth: dict, target_user_id: int) -> None:
    if not current_auth["is_admin"] and current_auth["user_id"] != target_user_id:
        raise HTTPException(status_code=403, detail="Token does not match the requested user")


def _serialize_user(user: models.User) -> schemas.UserResponse:
    return schemas.UserResponse(
        id=user.id,
        name=user.name,
        city=user.city,
        zone=user.zone,
        platform=user.platform,
        weekly_income=user.weekly_income,
        vehicle_type=getattr(user, "vehicle_type", "Bike"),
        vehicle_number=getattr(user, "vehicle_number", None),
        plan_tier=getattr(user, "plan_tier", "Standard"),
        phone=user.phone,
        upi_id=None,
        bank_name=getattr(user, "bank_name", None),
        bank_account_number=None,
        ifsc_code=None,
        emergency_contact=None,
        bank_account_last4=getattr(user, "bank_account_last4", None),
        has_upi=bool(getattr(user, "upi_hash", None)),
        emergency_contact_masked=getattr(user, "emergency_contact", None),
        shift_status=getattr(user, "shift_status", "Offline") or "Offline",
    )


def _log_audit(
    db: Session,
    *,
    actor_role: str,
    action: str,
    actor_id: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    status: str = "success",
    metadata: Optional[dict] = None,
) -> None:
    db.add(models.AuditLog(
        actor_role=actor_role,
        actor_id=actor_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        status=status,
        metadata_json=json.dumps(metadata or {}, separators=(",", ":"), sort_keys=True),
    ))


def _normalize_zone(zone: str) -> str:
    normalized = zone.strip()
    if normalized in ALL_ZONES:
        return normalized
    if len(normalized) == 1 and normalized.upper() in ("A", "B", "C", "D"):
        return f"Zone {normalized.upper()}"
    if normalized.lower().startswith("zone "):
        suffix = normalized.split(" ", 1)[1].strip().upper()
        if suffix in ("A", "B", "C", "D"):
            return f"Zone {suffix}"
    raise HTTPException(status_code=400, detail="Zone must be one of A/B/C/D or Zone A/Zone B/Zone C/Zone D")


def _distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in meters."""
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)
    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return 2 * r * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _recent_claim_counts_for_hashes(
    db: Session,
    *,
    ip_hash: Optional[str] = None,
    device_hash: Optional[str] = None,
    upi_hash: Optional[str] = None,
) -> dict:
    now = datetime.datetime.utcnow()
    one_hour_ago = now - datetime.timedelta(hours=1)
    one_day_ago = now - datetime.timedelta(hours=24)

    counts = {
        "same_ip_claims_1h": 0,
        "same_device_claims_24h": 0,
        "same_upi_claims_24h": 0,
    }

    if ip_hash:
        counts["same_ip_claims_1h"] = db.query(models.Claim).filter(
            models.Claim.ip_address_hash == ip_hash,
            models.Claim.timestamp >= one_hour_ago,
        ).count()
    if device_hash:
        counts["same_device_claims_24h"] = db.query(models.Claim).filter(
            models.Claim.device_hash == device_hash,
            models.Claim.timestamp >= one_day_ago,
        ).count()
    if upi_hash:
        counts["same_upi_claims_24h"] = db.query(models.Claim).filter(
            models.Claim.upi_hash == upi_hash,
            models.Claim.timestamp >= one_day_ago,
        ).count()
    return counts


# ---------------------------------------------------------------------------
# APScheduler — Automated Background Monitor
# ---------------------------------------------------------------------------

def run_zone_monitor():
    """
    Phase 3 upgrade: Only fires claims for workers with an ACTIVE shift.
    GPS evidence is fetched from TelemetryPing table and fused into the ML score.
    """
    db: Session = SessionLocal()
    triggers_this_run = []
    metric_events: list[tuple[str, bool]] = []

    try:
        logger.info("[Monitor] ⏱️  Starting zone weather check (shift-aware)...")

        for zone in ALL_ZONES:
            weather = get_weather(zone)
            trigger = weather.get("trigger")
            approved_this_run = 0

            if not trigger:
                logger.info(f"[Monitor] {zone}: No trigger. Rain={weather['rain_mm_per_hr']}mm/hr")
                continue

            logger.info(f"[Monitor] 🚨 TRIGGER DETECTED: {trigger} in {zone}")
            triggers_this_run.append({"zone": zone, "trigger": trigger})

            # Phase 3: Only process workers with an ACTIVE shift in this zone
            active_shifts = (
                db.query(models.WorkerShift)
                .join(models.User, models.WorkerShift.user_id == models.User.id)
                .filter(
                    models.User.zone == zone,
                    models.WorkerShift.is_active == True,
                )
                .all()
            )
            logger.info(f"[Monitor] Found {len(active_shifts)} workers on active shift in {zone}.")

            if not active_shifts:
                continue

            # All user IDs on shift
            shift_user_ids = [s.user_id for s in active_shifts]

            # Active policies for those on-shift workers
            active_policies = db.query(models.Policy).filter(
                models.Policy.user_id.in_(shift_user_ids),
                models.Policy.active_status == True,
                models.Policy.end_date >= datetime.datetime.utcnow()
            ).all()

            logger.info(f"[Monitor] {len(active_policies)} active policies for on-shift workers in {zone}.")

            # Count claims in last 30 min from this zone (network signal)
            thirty_min_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=30)
            policy_ids_zone = [p.id for p in active_policies]
            recent_claims_count = (
                db.query(models.Claim)
                  .filter(models.Claim.policy_id.in_(policy_ids_zone),
                          models.Claim.timestamp >= thirty_min_ago)
                  .count()
            )

            for policy in active_policies:
                user = db.query(models.User).filter(models.User.id == policy.user_id).first()
                if not user:
                    continue

                # Get the worker's active shift and its pings
                active_shift = next((s for s in active_shifts if s.user_id == user.id), None)
                shift_pings = []
                if active_shift:
                    shift_pings = (
                        db.query(models.TelemetryPing)
                          .filter(models.TelemetryPing.shift_id == active_shift.id)
                          .order_by(models.TelemetryPing.timestamp)
                          .all()
                    )

                # Build GPS fraud evidence
                telemetry_evidence = build_telemetry_evidence(active_shift, shift_pings)
                logger.info(
                    f"[Monitor] Worker {user.id} telemetry: "
                    f"pings={telemetry_evidence['telemetry_ping_count']}, "
                    f"continuity={telemetry_evidence['telemetry_continuity']:.2f}, "
                    f"stale={telemetry_evidence['telemetry_gps_stale']:.2f}"
                )

                # Count this user's claims this week
                week_ago = datetime.datetime.utcnow() - datetime.timedelta(days=7)
                user_weekly_claims = (
                    db.query(models.Claim)
                      .join(models.Policy)
                      .filter(models.Policy.user_id == user.id,
                              models.Claim.timestamp >= week_ago)
                      .count()
                )

                payout_amount = round(float(policy.premium_amount) * 3.5, 2)

                frs1, frs2, frs3, status, explanation, tx_id, agent_logs, signal_breakdown = \
                    evaluate_fraud_multipass(
                        zone=zone,
                        event_type=trigger,
                        user_id=user.id,
                        weekly_income=float(user.weekly_income),
                        payout_amount=payout_amount,
                        claim_count_this_week=user_weekly_claims,
                        same_zone_claims_30min=recent_claims_count,
                        telemetry=telemetry_evidence,
                    )
                fraud_alert_triggered = status in ("Hold", "Rejected")

                if status == "Approved" and _check_zone_payout_cap(
                    zone, db, pending_approved=approved_this_run
                ):
                    status = "Hold"
                    tx_id = None
                    explanation = (
                        f"Zone payout cap reached in {zone}; claim moved to manual review. "
                        f"{explanation}"
                    )
                    agent_logs.append({
                        "step": "ZONE_CAP",
                        "message": f"Auto-ceiling applied in {zone}; payout held.",
                    })

                claim = models.Claim(
                    policy_id=policy.id,
                    trigger_type=trigger,
                    payout_amount=payout_amount if status != "Rejected" else 0.0,
                    frs1=frs1,
                    frs2=frs2,
                    frs3=frs3,
                    frs_location=signal_breakdown["frs_location"],
                    frs_device=signal_breakdown["frs_device"],
                    frs_behavior=signal_breakdown["frs_behavior"],
                    frs_network=signal_breakdown["frs_network"],
                    frs_event=signal_breakdown["frs_event"],
                    explanation=explanation,
                    status=status,
                    transaction_id=tx_id,
                    rain_mm_at_trigger=weather.get("rain_mm_per_hr"),
                    aqi_at_trigger=None,
                    # Phase 3 GPS evidence
                    shift_id=active_shift.id if active_shift else None,
                    driver_lat=active_shift.last_lat if active_shift else None,
                    driver_lon=active_shift.last_lon if active_shift else None,
                    telemetry_continuity=telemetry_evidence.get("telemetry_continuity"),
                    telemetry_speed_risk=telemetry_evidence.get("telemetry_speed_risk"),
                    telemetry_gps_stale=telemetry_evidence.get("telemetry_gps_stale"),
                    telemetry_accuracy_risk=telemetry_evidence.get("telemetry_accuracy_risk"),
                    telemetry_distance_km=telemetry_evidence.get("telemetry_distance_km"),
                    telemetry_ping_count=telemetry_evidence.get("telemetry_ping_count"),
                )
                db.add(claim)
                db.flush()
                claim.token_id = claim.id

                if status == "Approved" and tx_id == "PENDING_PAYOUT":
                    payout_result = initiate_payout(user.name, payout_amount, claim_id=claim.id)
                    tx_id = payout_result.get("transaction_hash") or payout_result.get("transaction_id")
                    claim.transaction_id = tx_id
                    approved_this_run += 1

                _attach_claim_hash(
                    claim,
                    zone=zone,
                    event_type=trigger,
                    weather_snapshot=weather,
                    driver_id=user.id,
                )

                for log in agent_logs:
                    db.add(models.AgentLog(
                        claim_id=claim.id,
                        step=log["step"],
                        log_message=log["message"]
                    ))

                _log_audit(
                    db,
                    actor_role="system",
                    actor_id="scheduler",
                    action="auto_claim_created",
                    target_type="claim",
                    target_id=str(claim.id),
                    metadata={"zone": zone, "status": status, "token_id": claim.token_id},
                )
                metric_events.append((status, fraud_alert_triggered))

                if status == "Approved":
                    monitor_state["total_auto_claims"] += 1
                logger.info(f"[Monitor] Claim created for policy {policy.id}: {status} | FRS={frs3}")

        db.commit()
        for metric_status, metric_fraud_alert in metric_events:
            record_claim_metrics(status=metric_status, fraud_alert=metric_fraud_alert)
        monitor_state["last_run"]      = datetime.datetime.utcnow().isoformat()
        monitor_state["last_triggers"] = triggers_this_run
        logger.info("[Monitor] ✅ Zone check complete.")

    except Exception as e:
        logger.error(f"[Monitor] ❌ Error during zone monitoring: {e}")
        db.rollback()
    finally:
        db.close()


# ---------------------------------------------------------------------------
# App Lifecycle — Start/Stop Scheduler
# ---------------------------------------------------------------------------

scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    interval = 10   # minutes
    await connect_prisma()
    scheduler.add_job(run_zone_monitor, "interval", minutes=interval, id="zone_monitor")
    scheduler.start()
    logger.info(f"[Monitor] ✅ APScheduler started. Checking zones every {interval} minutes.")
    yield
    scheduler.shutdown()
    await disconnect_prisma()
    logger.info("[Monitor] APScheduler stopped.")


app = FastAPI(
    title="GiG-I Parametric Insurance API",
    description="Zero-touch parametric income protection for gig workers.",
    version="2.0.0",
    lifespan=lifespan
)

Instrumentator(
    excluded_handlers=["/metrics"],
    should_group_status_codes=False,
).instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS or ["*"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS if "*" not in CORS_ALLOW_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Rate Limiting Middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    """Apply sliding-window rate limiting to all routes except /health."""
    started = time.perf_counter()
    if request.url.path not in ("/health", "/metrics", "/docs", "/openapi.json", "/redoc"):
        try:
            client_ip = request.client.host if request.client else "unknown"
            rate_limit_check(client_ip)
        except HTTPException as e:
            return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time-Ms"] = str(round((time.perf_counter() - started) * 1000, 2))
    response.headers["Cache-Control"] = "no-store"
    if request.headers.get("X-Forwarded-Proto") == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    security_posture = get_security_posture()
    return {
        "status": "ok" if security_posture["production_ready"] else "degraded",
        "version": "2.0.0",
        "environment": APP_ENV,
        "scheduler_running": scheduler.running,
        "prisma_enabled": prisma_enabled(),
        "monitor_last_run": monitor_state["last_run"],
        "security": {
            "production_ready": security_posture["production_ready"],
            "warnings": security_posture["warnings"],
        },
    }


@app.get("/ready")
def ready():
    security_posture = get_security_posture()
    ready_state = scheduler.running
    if APP_ENV == "production":
        ready_state = ready_state and security_posture["production_ready"]

    if not ready_state:
        raise HTTPException(
            status_code=503,
            detail={
                "scheduler_running": scheduler.running,
                "security_production_ready": security_posture["production_ready"],
                "warnings": security_posture["warnings"],
            },
        )

    return {
        "status": "ready",
        "scheduler_running": scheduler.running,
        "prisma_enabled": prisma_enabled(),
        "security_production_ready": security_posture["production_ready"],
    }


@app.get("/admin/monitor-status")
def monitor_status(_: dict = Depends(require_admin)):
    """Returns the last run time, triggers detected, and total auto-claims fired."""
    return {
        "last_run":          monitor_state["last_run"],
        "last_triggers":     monitor_state["last_triggers"],
        "total_auto_claims": monitor_state["total_auto_claims"],
        "zones_monitored":   ALL_ZONES,
        "interval_minutes":  10,
    }


@app.get("/weather/live")
def live_weather():
    """Returns current real weather for all monitored zones."""
    return {zone: get_weather(zone) for zone in ALL_ZONES}


# ---------------------------------------------------------------------------
# Auth Endpoints (README §18)
# ---------------------------------------------------------------------------

class LoginRequest(BaseModel):
    user_id: Optional[int] = None
    phone: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v):
        if v is None: return v
        from schemas import _validate_indian_mobile
        return _validate_indian_mobile(v, "phone")


class OtpRequest(BaseModel):
    phone: str

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v):
        from schemas import _validate_indian_mobile
        return _validate_indian_mobile(v, "phone")


class OtpVerifyRequest(BaseModel):
    phone: str
    otp: str

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v):
        from schemas import _validate_indian_mobile
        return _validate_indian_mobile(v, "phone")


class AdminOtpRequest(BaseModel):
    username: str
    password: str


class AdminOtpVerifyRequest(AdminOtpRequest):
    otp: str


class UserProfileUpdate(BaseModel):
    city: Optional[str] = None
    zone: Optional[str] = None
    platform: Optional[str] = None
    weekly_income: Optional[float] = None
    vehicle_type: Optional[str] = None
    vehicle_number: Optional[str] = None
    upi_id: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    emergency_contact: Optional[str] = None
    shift_status: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class AdminLoginRequest(BaseModel):
    username: str
    password: str
    otp: str


@app.post("/auth/otp/request")
@app.post("/api/v1/auth/send-otp")
async def request_phone_otp(req: OtpRequest):
    try:
        result = await otp_service.send_otp(req.phone, purpose="worker")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Worker OTP dispatch failed")
        raise HTTPException(status_code=502, detail="OTP gateway unavailable") from exc

    payload = {
        "phoneMasked": result.phone_masked,
        "expiresInSeconds": result.expires_in_seconds,
        "provider": result.provider,
        "message": "OTP sent",
    }
    if result.demo_otp:
        payload["demoOtp"] = result.demo_otp
    return payload


@app.post("/auth/otp/verify")
@app.post("/api/v1/auth/verify-otp")
async def verify_phone_otp(req: OtpVerifyRequest):
    try:
        result = await otp_service.verify_otp(req.phone, req.otp, purpose="worker")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Worker OTP verification failed")
        raise HTTPException(status_code=502, detail="OTP gateway unavailable") from exc
    if not result["verified"]:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")
    return result


def _verify_admin_password_only(username: str, password: str) -> None:
    if not hmac.compare_digest(username, settings.admin_username):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    if not hmac.compare_digest(password, settings.admin_password):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")


@app.post("/api/v1/admin/send-otp")
async def request_admin_otp(req: AdminOtpRequest):
    _verify_admin_password_only(req.username, req.password)
    admin_phone = settings.admin_phone_number or ("9999999999" if APP_ENV != "production" else "")
    if not admin_phone:
        raise HTTPException(status_code=500, detail="ADMIN_PHONE_NUMBER is not configured")

    try:
        result = await otp_service.send_otp(admin_phone, purpose="admin")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Admin OTP dispatch failed")
        raise HTTPException(status_code=502, detail="OTP gateway unavailable") from exc

    payload = {
        "phoneMasked": result.phone_masked,
        "expiresInSeconds": result.expires_in_seconds,
        "provider": result.provider,
        "message": "Admin OTP sent",
    }
    if result.demo_otp:
        payload["demoOtp"] = result.demo_otp
    return payload


@app.post("/api/v1/admin/verify-otp", response_model=schemas.AuthResponse)
async def verify_admin_otp(req: AdminOtpVerifyRequest, db: Session = Depends(get_db)):
    _verify_admin_password_only(req.username, req.password)
    admin_phone = settings.admin_phone_number or ("9999999999" if APP_ENV != "production" else "")
    try:
        result = await otp_service.verify_otp(admin_phone, req.otp, purpose="admin")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Admin OTP verification failed")
        raise HTTPException(status_code=502, detail="OTP gateway unavailable") from exc
    if not result["verified"]:
        raise HTTPException(status_code=401, detail="Invalid or expired admin OTP")

    tokens = create_token_pair(0, role="admin")
    _log_audit(
        db,
        actor_role="admin",
        actor_id=req.username,
        action="admin_sms_otp_login",
        target_type="system",
        target_id="admin",
    )
    db.commit()
    return schemas.AuthResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user_id=0,
        user=schemas.UserResponse(
            id=0,
            name="Admin",
            city="N/A",
            zone="Zone A",
            platform="Admin",
            weekly_income=0,
            vehicle_type="N/A",
            plan_tier="Admin",
            phone=None,
            upi_id=None,
        ),
    )


@app.post("/login", response_model=schemas.AuthResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """Issue a JWT token for an existing worker using either user_id or phone."""
    user = None
    if req.user_id is not None:
        user = db.query(models.User).filter(models.User.id == req.user_id).first()
    elif req.phone:
        phone_hash = hash_identifier(req.phone)
        user = db.query(models.User).filter(models.User.phone_hash == phone_hash).first()
        if not user:
            user = db.query(models.User).filter(models.User.phone == req.phone).first()
    else:
        raise HTTPException(status_code=400, detail="Provide either user_id or phone")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    tokens = create_token_pair(user.id)
    _log_audit(
        db,
        actor_role="user",
        actor_id=str(user.id),
        action="worker_login",
        target_type="user",
        target_id=str(user.id),
    )
    db.commit()
    return schemas.AuthResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user_id=user.id,
        user=_serialize_user(user),
    )


@app.post("/register", response_model=schemas.AuthResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new gig worker and return a JWT access token."""
    if user.phone:
        existing = db.query(models.User).filter(models.User.phone_hash == hash_identifier(user.phone)).first()
        if existing:
            raise HTTPException(status_code=409, detail="User already exists for this phone number")

    db_user = models.User(
        name=user.name,
        city=user.city,
        zone=_normalize_zone(user.zone),
        platform=user.platform,
        weekly_income=user.weekly_income,
        vehicle_type=user.vehicle_type or "Bike",
        vehicle_number=user.vehicle_number,
        plan_tier=user.plan_tier or "Standard",
        shift_status="Offline",
        phone=mask_phone(user.phone),
        phone_hash=hash_identifier(user.phone),
        phone_encrypted=encrypt_secret(user.phone),
        upi_hash=hash_identifier(user.upi_id),
        upi_encrypted=encrypt_secret(user.upi_id),
        bank_name=user.bank_name,
        bank_account_last4=("".join(ch for ch in (user.bank_account_number or "") if ch.isdigit())[-4:] or None),
        bank_account_hash=hash_identifier(user.bank_account_number),
        bank_account_encrypted=encrypt_secret(user.bank_account_number),
        ifsc_hash=hash_identifier(user.ifsc_code),
        ifsc_encrypted=encrypt_secret(user.ifsc_code),
        emergency_contact=mask_phone(user.emergency_contact),
        emergency_contact_hash=hash_identifier(user.emergency_contact),
        emergency_contact_encrypted=encrypt_secret(user.emergency_contact),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    tokens = create_token_pair(db_user.id)
    _log_audit(
        db,
        actor_role="user",
        actor_id=str(db_user.id),
        action="worker_register",
        target_type="user",
        target_id=str(db_user.id),
        metadata={"zone": db_user.zone},
    )
    db.commit()
    return schemas.AuthResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user_id=db_user.id,
        user=_serialize_user(db_user),
    )


# ---------------------------------------------------------------------------
# Phase 3: Shift & GPS Telemetry Endpoints
# ---------------------------------------------------------------------------

@app.post("/api/v1/shift/start", response_model=schemas.ShiftStatusResponse)
def start_shift(req: schemas.ShiftStartRequest, db: Session = Depends(get_db),
                current_auth: dict = Depends(get_auth_context)):
    """Worker taps 'Go Online'. Creates a WorkerShift row and records first GPS ping."""
    if current_auth.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin cannot start a worker shift")
    user_id = current_auth["user_id"]

    # Close any stale open shifts
    stale = db.query(models.WorkerShift).filter(
        models.WorkerShift.user_id == user_id,
        models.WorkerShift.is_active == True,
    ).all()
    for s in stale:
        s.is_active = False
        s.ended_at = datetime.datetime.utcnow()

    shift = models.WorkerShift(
        user_id=user_id,
        is_active=True,
        last_lat=req.lat,
        last_lon=req.lon,
        last_ping_at=datetime.datetime.utcnow(),
    )
    db.add(shift)
    db.flush()

    # First ping
    db.add(models.TelemetryPing(
        shift_id=shift.id,
        user_id=user_id,
        lat=req.lat,
        lon=req.lon,
        accuracy_m=req.accuracy_m,
    ))

    # Update user shift_status
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        user.shift_status = "Active"

    db.commit()
    db.refresh(shift)

    ping_count = db.query(models.TelemetryPing).filter(models.TelemetryPing.shift_id == shift.id).count()
    return schemas.ShiftStatusResponse(
        shift_id=shift.id,
        is_active=True,
        started_at=shift.started_at,
        last_ping_at=shift.last_ping_at,
        ping_count=ping_count,
        last_lat=shift.last_lat,
        last_lon=shift.last_lon,
    )


@app.post("/api/v1/shift/ping", response_model=schemas.ShiftStatusResponse)
def ping_shift(req: schemas.TelemetryPingRequest, db: Session = Depends(get_db),
               current_auth: dict = Depends(get_auth_context)):
    """Worker sends a GPS heartbeat during an active shift (every ~30 s)."""
    if current_auth.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin cannot send shift pings")
    user_id = current_auth["user_id"]

    shift = db.query(models.WorkerShift).filter(
        models.WorkerShift.user_id == user_id,
        models.WorkerShift.is_active == True,
    ).order_by(models.WorkerShift.started_at.desc()).first()

    if not shift:
        raise HTTPException(status_code=404, detail="No active shift found. Call /shift/start first.")

    db.add(models.TelemetryPing(
        shift_id=shift.id,
        user_id=user_id,
        lat=req.lat,
        lon=req.lon,
        accuracy_m=req.accuracy_m,
        speed_kmh=req.speed_kmh,
        heading=req.heading,
    ))

    # Update last known position on shift
    shift.last_lat = req.lat
    shift.last_lon = req.lon
    shift.last_ping_at = datetime.datetime.utcnow()

    db.commit()

    ping_count = db.query(models.TelemetryPing).filter(models.TelemetryPing.shift_id == shift.id).count()
    return schemas.ShiftStatusResponse(
        shift_id=shift.id,
        is_active=True,
        started_at=shift.started_at,
        last_ping_at=shift.last_ping_at,
        ping_count=ping_count,
        last_lat=shift.last_lat,
        last_lon=shift.last_lon,
    )


@app.post("/api/v1/shift/end", response_model=schemas.ShiftStatusResponse)
def end_shift(db: Session = Depends(get_db),
              current_auth: dict = Depends(get_auth_context)):
    """Worker taps 'Go Offline'. Closes the active shift."""
    if current_auth.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin cannot end a worker shift")
    user_id = current_auth["user_id"]

    shift = db.query(models.WorkerShift).filter(
        models.WorkerShift.user_id == user_id,
        models.WorkerShift.is_active == True,
    ).order_by(models.WorkerShift.started_at.desc()).first()

    if not shift:
        raise HTTPException(status_code=404, detail="No active shift to end.")

    shift.is_active = False
    shift.ended_at = datetime.datetime.utcnow()

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user:
        user.shift_status = "Offline"

    db.commit()

    ping_count = db.query(models.TelemetryPing).filter(models.TelemetryPing.shift_id == shift.id).count()
    return schemas.ShiftStatusResponse(
        shift_id=shift.id,
        is_active=False,
        started_at=shift.started_at,
        last_ping_at=shift.last_ping_at,
        ping_count=ping_count,
        last_lat=shift.last_lat,
        last_lon=shift.last_lon,
    )


@app.get("/api/v1/shift/status", response_model=schemas.ShiftStatusResponse)
def get_shift_status(db: Session = Depends(get_db),
                     current_auth: dict = Depends(get_auth_context)):
    """Returns the worker's current shift status and last GPS position."""
    if current_auth.get("is_admin"):
        raise HTTPException(status_code=403, detail="Use admin endpoints")
    user_id = current_auth["user_id"]

    shift = db.query(models.WorkerShift).filter(
        models.WorkerShift.user_id == user_id,
    ).order_by(models.WorkerShift.started_at.desc()).first()

    if not shift:
        return schemas.ShiftStatusResponse(is_active=False, ping_count=0)

    ping_count = db.query(models.TelemetryPing).filter(models.TelemetryPing.shift_id == shift.id).count()
    return schemas.ShiftStatusResponse(
        shift_id=shift.id,
        is_active=bool(shift.is_active),
        started_at=shift.started_at,
        last_ping_at=shift.last_ping_at,
        ping_count=ping_count,
        last_lat=shift.last_lat,
        last_lon=shift.last_lon,
    )



@app.post("/token/refresh", response_model=schemas.AuthResponse)
def refresh_token(req: RefreshTokenRequest, db: Session = Depends(get_db)):
    payload = decode_refresh_token(req.refresh_token)
    if payload.get("role") == "admin":
        tokens = create_token_pair(0, role="admin")
        return schemas.AuthResponse(
            access_token=tokens["access_token"],
            refresh_token=tokens["refresh_token"],
            user_id=0,
            user=schemas.UserResponse(
                id=0,
                name="Admin",
                city="N/A",
                zone="Zone A",
                platform="Admin",
                weekly_income=0,
                vehicle_type="N/A",
                plan_tier="Admin",
                phone=None,
                upi_id=None,
            ),
        )

    user = db.query(models.User).filter(models.User.id == payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    tokens = create_token_pair(user.id)
    return schemas.AuthResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user_id=user.id,
        user=_serialize_user(user),
    )


@app.post("/admin/login", response_model=schemas.AuthResponse)
def admin_login(req: AdminLoginRequest, db: Session = Depends(get_db)):
    verify_admin_credentials(req.username, req.password, req.otp)
    tokens = create_token_pair(0, role="admin")
    _log_audit(
        db,
        actor_role="admin",
        actor_id=req.username,
        action="admin_login",
        target_type="system",
        target_id="admin",
    )
    db.commit()
    return schemas.AuthResponse(
        access_token=tokens["access_token"],
        refresh_token=tokens["refresh_token"],
        user_id=0,
        user=schemas.UserResponse(
            id=0,
            name="Admin",
            city="N/A",
            zone="Zone A",
            platform="Admin",
            weekly_income=0,
            vehicle_type="N/A",
            plan_tier="Admin",
            phone=None,
            upi_id=None,
        ),
    )


@app.get("/quote/{user_id}")
def get_quote(
    user_id: int,
    db: Session = Depends(get_db),
    current_auth: dict = Depends(get_auth_context),
):
    _authorize_user_scope(current_auth, user_id)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        premium, factors, hours = calculate_premium(
            user.weekly_income,
            user.zone,
            user.platform,
            getattr(user, "vehicle_type", "Bike"),
            user.city,
        )
    except Exception as e:
        logger.warning(f"[Quote] Premium calculation failed: {e}. Using fallback.")
        premium = 150.0
        factors = ["Fallback pricing applied"]
        hours   = 10.0

    return {
        "user_id":       user_id,
        "premium":       round(premium, 2),
        "ml_factors":    factors,
        "lost_hours_est": hours,
    }


@app.post("/policy/create", response_model=schemas.PolicyResponse)
def create_policy(
    policy: schemas.PolicyCreate,
    db: Session = Depends(get_db),
    current_auth: dict = Depends(get_auth_context),
):
    _authorize_user_scope(current_auth, policy.user_id)
    existing_active = db.query(models.Policy).filter(
        models.Policy.user_id == policy.user_id,
        models.Policy.active_status == True,
        models.Policy.end_date >= datetime.datetime.utcnow(),
    ).first()
    if existing_active:
        raise HTTPException(status_code=409, detail="An active policy already exists for this user")

    end_date  = datetime.datetime.utcnow() + datetime.timedelta(days=7)
    db_policy = models.Policy(
        user_id=policy.user_id,
        end_date=end_date,
        premium_amount=policy.premium_amount
    )
    db.add(db_policy)
    _log_audit(
        db,
        actor_role="user",
        actor_id=str(policy.user_id),
        action="policy_create",
        target_type="policy",
        metadata={"premium_amount": policy.premium_amount},
    )
    db.commit()
    db.refresh(db_policy)
    return db_policy


@app.get("/policies/{user_id}")
def get_policies(
    user_id: int,
    db: Session = Depends(get_db),
    current_auth: dict = Depends(get_auth_context),
):
    _authorize_user_scope(current_auth, user_id)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    policies = (
        db.query(models.Policy)
        .filter(models.Policy.user_id == user_id)
        .order_by(models.Policy.start_date.desc())
        .all()
    )

    return {
        "userId": user_id,
        "policies": [schemas.PolicyResponse.model_validate(policy) for policy in policies],
    }


@app.get("/policy/{policy_id}")
def get_policy_detail(
    policy_id: int,
    db: Session = Depends(get_db),
    current_auth: dict = Depends(get_auth_context),
):
    policy = db.query(models.Policy).filter(models.Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    _authorize_user_scope(current_auth, policy.user_id)
    user = db.query(models.User).filter(models.User.id == policy.user_id).first()
    claims = (
        db.query(models.Claim)
        .filter(models.Claim.policy_id == policy_id)
        .order_by(models.Claim.timestamp.desc())
        .all()
    )

    approved_payout_total = sum(float(claim.payout_amount or 0) for claim in claims if claim.status == "Approved")
    latest_claim = claims[0] if claims else None

    return {
        "policy": schemas.PolicyResponse.model_validate(policy),
        "driver": _serialize_user(user) if user else None,
        "coverageRemaining": round(max((float(policy.premium_amount) * 12.0) - approved_payout_total, 0.0), 2),
        "triggerRules": {
            "heavyRain": "> 60 mm/hour or IMD heavy rain alert",
            "extremeHeat": "> 42C plus advisory",
            "urbanShutdown": "curfew or official closure",
        },
        "latestFraudSignals": {
            "event": getattr(latest_claim, "frs_event", None),
            "location": getattr(latest_claim, "frs_location", None),
            "device": getattr(latest_claim, "frs_device", None),
            "behavior": getattr(latest_claim, "frs_behavior", None),
            "network": getattr(latest_claim, "frs_network", None),
        },
        "claims": [schemas.ClaimResponse.model_validate(claim) for claim in claims[:20]],
    }


@app.get("/user/{user_id}/dashboard")
def get_dashboard(
    user_id: int,
    db: Session = Depends(get_db),
    current_auth: dict = Depends(get_auth_context),
):
    _authorize_user_scope(current_auth, user_id)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    policies     = db.query(models.Policy).filter(models.Policy.user_id == user_id).all()
    active_policy = next((p for p in policies if p.active_status), None)

    claims = []
    total_balance = 0.0

    for p in policies:
        for c in db.query(models.Claim).filter(models.Claim.policy_id == p.id).all():
            claims.append(schemas.ClaimResponse.model_validate(c))
            if c.status == "Approved" and c.payout_amount:
                total_balance += float(c.payout_amount)

    return {
        "user_meta": {
            "full_name":     user.name,
            "city":          user.city,
            "zone":          user.zone,
            "platform":      user.platform,
            "weekly_income": user.weekly_income,
            "vehicle_type":  getattr(user, "vehicle_type", "Bike"),
            "vehicle_number": getattr(user, "vehicle_number", None),
            "phone":         user.phone,
            "plan_tier":     getattr(user, "plan_tier", "Standard"),
            "shift_status":   getattr(user, "shift_status", "Offline") or "Offline",
            "bank_name":      getattr(user, "bank_name", None),
            "bank_account_last4": getattr(user, "bank_account_last4", None),
            "has_upi":        bool(getattr(user, "upi_hash", None)),
            "emergency_contact_masked": getattr(user, "emergency_contact", None),
        },
        "active_policy":  schemas.PolicyResponse.model_validate(active_policy) if active_policy else None,
        "wallet_balance": total_balance,
        "claims":         claims,
    }


@app.put("/user/{user_id}/profile", response_model=schemas.UserResponse)
def update_user_profile(
    user_id: int,
    profile: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_auth: dict = Depends(get_auth_context),
):
    _authorize_user_scope(current_auth, user_id)
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field in ["city", "platform", "weekly_income", "vehicle_type", "vehicle_number", "bank_name", "shift_status"]:
        value = getattr(profile, field)
        if value is not None:
            setattr(user, field, value)
    if profile.zone is not None:
        user.zone = _normalize_zone(profile.zone)
    if profile.upi_id is not None:
        user.upi_hash = hash_identifier(profile.upi_id)
        user.upi_encrypted = encrypt_secret(profile.upi_id)
    if profile.bank_account_number is not None:
        digits = "".join(ch for ch in profile.bank_account_number if ch.isdigit())
        user.bank_account_last4 = digits[-4:] if digits else None
        user.bank_account_hash = hash_identifier(profile.bank_account_number)
        user.bank_account_encrypted = encrypt_secret(profile.bank_account_number)
    if profile.ifsc_code is not None:
        user.ifsc_hash = hash_identifier(profile.ifsc_code)
        user.ifsc_encrypted = encrypt_secret(profile.ifsc_code)
    if profile.emergency_contact is not None:
        user.emergency_contact = mask_phone(profile.emergency_contact)
        user.emergency_contact_hash = hash_identifier(profile.emergency_contact)
        user.emergency_contact_encrypted = encrypt_secret(profile.emergency_contact)

    _log_audit(
        db,
        actor_role="user",
        actor_id=str(user_id),
        action="profile_update",
        target_type="user",
        target_id=str(user_id),
    )
    db.commit()
    db.refresh(user)
    return _serialize_user(user)


# ---------------------------------------------------------------------------
# Wallet & Ledger Endpoints (README §API Contracts)
# ---------------------------------------------------------------------------

@app.get("/wallet/{driver_id}")
async def get_wallet(
    driver_id: int,
    db: Session = Depends(get_db),
    current_auth: dict = Depends(get_auth_context),
    prisma_db: Optional[Any] = Depends(get_prisma_dependency),
):
    """
    Returns the wallet balance (total approved payouts) for a driver.
    README §API Contracts: GET /wallet/{driverId}
    """
    _authorize_user_scope(current_auth, driver_id)
    if prisma_db is not None:
        return await wallet_view(prisma_db, driver_id)
    user = db.query(models.User).filter(models.User.id == driver_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Driver not found")

    policies = db.query(models.Policy).filter(models.Policy.user_id == driver_id).all()
    policy_ids = [p.id for p in policies]

    approved_claims = (
        db.query(models.Claim)
          .filter(
              models.Claim.policy_id.in_(policy_ids),
              models.Claim.status == "Approved"
          )
          .order_by(models.Claim.timestamp.desc())
          .all()
    )

    total_balance = sum(float(c.payout_amount or 0) for c in approved_claims)
    transactions = [
        {
            "tokenId": claim.token_id or claim.id,
            "type": "payout",
            "event": claim.trigger_type,
            "amount": round(float(claim.payout_amount or 0), 2),
            "timestamp": claim.timestamp.isoformat(),
            "transactionId": claim.transaction_id,
            "transactionHash": claim.transaction_id,
            "status": claim.status,
        }
        for claim in approved_claims[:10]
    ]

    return {
        "driverId": driver_id,
        "balanceTokens": round(total_balance, 2),
        "transactions": transactions,
        "driver_name": user.name,
        "zone": user.zone,
    }


@app.get("/ledger")
async def get_ledger(
    status: Optional[str] = None,
    zone: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
    prisma_db: Optional[Any] = Depends(get_prisma_dependency),
):
    """
    Returns full claims ledger across all drivers.
    README §API Contracts: GET /ledger
    Optional filters: ?status=Approved|Rejected|Hold&zone=Zone+A
    """
    if prisma_db is not None:
        return await ledger_view(
            prisma_db,
            status=status,
            zone=zone,
            limit=limit,
        )

    query = db.query(models.Claim).join(models.Policy).join(models.User)

    if status:
        query = query.filter(models.Claim.status == status)
    if zone:
        query = query.filter(models.User.zone == zone)

    claims = query.order_by(models.Claim.timestamp.desc()).limit(limit).all()

    ledger_entries = []
    for c in claims:
        policy = db.query(models.Policy).filter(models.Policy.id == c.policy_id).first()
        user   = db.query(models.User).filter(models.User.id == policy.user_id).first() if policy else None
        ledger_entries.append({
            "event": c.trigger_type,
            "driverId": user.id if user else None,
            "driverName": user.name if user else "Unknown",
            "zone": user.zone if user else "Unknown",
            "time": c.timestamp.isoformat(),
            "tokenId": c.token_id or c.id,
            "FRS": c.frs3,
            "status": c.status,
            "amount": round(float(c.payout_amount or 0), 2),
            "transactionId": c.transaction_id,
            "transactionHash": c.transaction_id,
            "dataHash": c.data_hash,
        })

    return {
        "entries": ledger_entries,
        "total": len(ledger_entries),
        "filters": {"status": status, "zone": zone},
    }


# ---------------------------------------------------------------------------
# Admin Routes
# ---------------------------------------------------------------------------

@app.get("/admin/dashboard")
def get_admin_dashboard(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    claims = db.query(models.Claim).order_by(models.Claim.timestamp.desc()).all()
    return {"claims": [schemas.ClaimResponse.model_validate(c) for c in claims]}


@app.get("/admin/agent-logs")
def get_agent_logs(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    logs = db.query(models.AgentLog).order_by(models.AgentLog.id.desc()).limit(150).all()
    return {"logs": [schemas.AgentLogResponse.model_validate(l) for l in logs]}


@app.get("/admin/audit-logs")
def get_audit_logs(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    logs = db.query(models.AuditLog).order_by(models.AuditLog.id.desc()).limit(200).all()
    return {"logs": [schemas.AuditLogResponse.model_validate(l) for l in logs]}


@app.get("/admin/metrics")
def get_admin_metrics(
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    security_posture = get_security_posture()
    total_users = db.query(models.User).count()
    total_policies = db.query(models.Policy).count()
    total_claims = db.query(models.Claim).count()
    approved_claims = db.query(models.Claim).filter(models.Claim.status == "Approved").count()
    hold_claims = db.query(models.Claim).filter(models.Claim.status == "Hold").count()
    rejected_claims = db.query(models.Claim).filter(models.Claim.status == "Rejected").count()
    total_payout = db.query(models.Claim).filter(models.Claim.status == "Approved").all()

    return {
        "environment": APP_ENV,
        "scheduler_running": scheduler.running,
        "monitor": monitor_state,
        "security": {
            "production_ready": security_posture["production_ready"],
            "warnings": security_posture["warnings"],
        },
        "counts": {
            "users": total_users,
            "policies": total_policies,
            "claims": total_claims,
            "approved_claims": approved_claims,
            "hold_claims": hold_claims,
            "rejected_claims": rejected_claims,
        },
        "approved_payout_total": round(
            sum(float(claim.payout_amount or 0) for claim in total_payout),
            2,
        ),
    }


class AdminReviewRequest(BaseModel):
    decision: str       # "Approved" or "Rejected"
    notes:    Optional[str] = None


@app.post("/admin/review/{claim_id}")
def admin_review_claim(
    claim_id: int,
    req: AdminReviewRequest,
    db: Session = Depends(get_db),
    _: dict = Depends(require_admin),
):
    """Allows admin to manually approve or reject a 'Hold' claim."""
    claim = db.query(models.Claim).filter(models.Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.status not in ("Hold", "Pending"):
        raise HTTPException(status_code=400, detail=f"Claim is already '{claim.status}'")

    normalized_decision = req.decision.strip().lower()
    if normalized_decision not in ("approve", "approved", "reject", "rejected"):
        raise HTTPException(status_code=400, detail="Decision must be Approve or Reject")

    claim.status = "Approved" if normalized_decision.startswith("approve") else "Rejected"
    claim.reviewed_by_admin = True
    claim.review_notes     = req.notes or ""
    policy = db.query(models.Policy).filter(models.Policy.id == claim.policy_id).first()

    # Fire payout if admin approves
    if claim.status == "Approved":
        user   = db.query(models.User).filter(models.User.id == policy.user_id).first() if policy else None
        if user:
            payout = initiate_payout(user.name, float(claim.payout_amount), claim.id)
            claim.transaction_id = payout.get("transaction_hash") or payout.get("transaction_id")
            if not claim.token_id:
                claim.token_id = claim.id

    _attach_claim_hash(
        claim,
        zone=policy.user.zone if (policy and policy.user) else "Unknown",
        event_type=claim.trigger_type,
        driver_id=policy.user_id if policy else None,
    )

    _log_audit(
        db,
        actor_role="admin",
        actor_id="0",
        action="manual_claim_review",
        target_type="claim",
        target_id=str(claim.id),
        metadata={"decision": claim.status},
    )

    db.commit()
    record_claim_metrics(status=claim.status)
    return {"message": f"Claim {claim_id} updated to '{claim.status}'",
            "transaction_id": claim.transaction_id,
            "transaction_hash": claim.transaction_id}


# ---------------------------------------------------------------------------
# Event Replay Mode (for demo / judges)
# ---------------------------------------------------------------------------

ZONE_PAYOUT_CAP_MULTIPLIER = 2.0  # 200% of avg predicted density per zone per day
ZONE_BASELINE_PAYOUTS_PER_DAY = {z: 5 for z in ["Zone A", "Zone B", "Zone C", "Zone D"]}


def _check_zone_payout_cap(zone: str, db: Session, pending_approved: int = 0) -> bool:
    """
    README §17: Auto-ceiling if claims > 200% predicted density.
    Returns True if zone is at cap (no more payouts), False if okay.
    """
    day_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Count approved payouts in this zone today
    users_in_zone = db.query(models.User).filter(models.User.zone == zone).all()
    user_ids = [u.id for u in users_in_zone]
    active_pids = [p.id for p in db.query(models.Policy)
                   .filter(models.Policy.user_id.in_(user_ids)).all()]

    payouts_today = (
        db.query(models.Claim)
          .filter(
              models.Claim.policy_id.in_(active_pids),
              models.Claim.status == "Approved",
              models.Claim.timestamp >= day_start
          ).count()
    )

    baseline = ZONE_BASELINE_PAYOUTS_PER_DAY.get(zone, 5)
    cap = int(baseline * ZONE_PAYOUT_CAP_MULTIPLIER)

    if payouts_today + pending_approved >= cap:
        logger.warning(
            f"[ZoneCap] {zone} hit payout cap: {payouts_today + pending_approved}/{cap} payouts today."
        )
        return True
    return False


async def _ensure_prisma_driver_and_policies(
    prisma_db: Any,
    db: Session,
    *,
    driver_id: int,
    zone: str,
) -> tuple[Any, list[Any]]:
    driver = await prisma_db.driver.find_unique(where={"id": driver_id})
    sql_user = None
    try:
        sql_user = db.query(models.User).filter(models.User.id == driver_id).first()
    except SQLAlchemyError:
        sql_user = None

    if not driver:
        if not sql_user:
            raise HTTPException(status_code=404, detail="Driver not found")
        driver = await prisma_db.driver.create(
            data={
                "id": sql_user.id,
                "fullName": sql_user.name,
                "city": sql_user.city,
                "zone": sql_user.zone,
                "platform": sql_user.platform,
                "weeklyIncome": float(sql_user.weekly_income),
                "vehicleType": getattr(sql_user, "vehicle_type", "Bike"),
                "planTier": getattr(sql_user, "plan_tier", "Standard"),
                "phoneMasked": sql_user.phone,
                "phoneHash": sql_user.phone_hash,
                "phoneEncrypted": sql_user.phone_encrypted,
                "upiHash": sql_user.upi_hash,
                "upiEncrypted": sql_user.upi_encrypted,
            }
        )

    policies = await get_active_policies_for_driver(prisma_db, driver_id)
    if policies:
        return driver, policies

    if not sql_user:
        try:
            sql_user = db.query(models.User).filter(models.User.id == driver_id).first()
        except SQLAlchemyError:
            sql_user = None
    if not sql_user:
        raise HTTPException(status_code=404, detail="Driver not found")

    sql_policies = db.query(models.Policy).filter(
        models.Policy.user_id == driver_id,
        models.Policy.active_status == True,
        models.Policy.end_date >= datetime.datetime.utcnow(),
    ).all()

    for policy in sql_policies:
        await prisma_db.policy.upsert(
            where={"id": policy.id},
            data={
                "create": {
                    "id": policy.id,
                    "driverId": sql_user.id,
                    "premiumAmount": float(policy.premium_amount),
                    "activeStatus": bool(policy.active_status),
                    "startDate": policy.start_date,
                    "endDate": policy.end_date,
                },
                "update": {
                    "premiumAmount": float(policy.premium_amount),
                    "activeStatus": bool(policy.active_status),
                    "startDate": policy.start_date,
                    "endDate": policy.end_date,
                },
            },
        )

    policies = await get_active_policies_for_driver(prisma_db, driver_id)
    if not policies:
        raise HTTPException(status_code=404, detail="No active policies found for the requested zone/driver")
    return driver, policies


async def _simulate_event_prisma(
    req: "EventTriggerRequest",
    request: Request,
    db: Session,
    current_auth: dict,
    prisma_db: Any,
):
    req.zone = _normalize_zone(req.zone)
    if req.driver_id is not None:
        _authorize_user_scope(current_auth, req.driver_id)

    requested_driver_id = req.driver_id or current_auth.get("user_id")
    if requested_driver_id is None:
        raise HTTPException(status_code=400, detail="driver_id is required")

    driver, active_policies = await _ensure_prisma_driver_and_policies(
        prisma_db,
        db,
        driver_id=requested_driver_id,
        zone=req.zone,
    )
    if driver.zone != req.zone:
        raise HTTPException(status_code=400, detail="Driver does not belong to the requested zone")

    request_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    device_id = req.device_id or request.headers.get("X-Device-ID")
    upi_id = req.upi_id or request.headers.get("X-UPI-ID")
    ip_hash = hash_identifier(request_ip)
    device_hash = hash_identifier(device_id)
    upi_hash = hash_identifier(upi_id) or driver.upiHash

    recent_hash_counts = await count_recent_hash_activity(
        prisma_db,
        ip_hash=ip_hash,
        device_hash=device_hash,
        upi_hash=upi_hash,
    )

    zone_lat, zone_lon = ZONE_COORDS.get(req.zone, ZONE_COORDS["Zone A"])
    geofence_distance_m = None
    if req.location:
        geofence_distance_m = _distance_meters(req.location.lat, req.location.lon, zone_lat, zone_lon)

    recent_count = await count_recent_claims_for_driver(prisma_db, requested_driver_id, 30)
    weekly_claims = await count_weekly_claims_for_driver(prisma_db, requested_driver_id)
    processed = []
    metric_events: list[tuple[str, bool]] = []
    approved_this_request = 0

    for policy in active_policies:
        cluster_flagged = any([
            recent_hash_counts["same_device_claims_24h"] > 2,
            recent_hash_counts["same_ip_claims_1h"] > 2,
            recent_hash_counts["same_upi_claims_24h"] > 1,
        ])

        frs1, frs2, frs3, status, explanation, _tx_id, _agent_logs, signal_breakdown = await asyncio.to_thread(
            evaluate_fraud_multipass,
            zone=req.zone,
            event_type=req.event_type,
            user_id=driver.id,
            weekly_income=float(driver.weeklyIncome),
            payout_amount=req.amount_per_claim,
            claim_count_this_week=weekly_claims,
            same_zone_claims_30min=recent_count,
            geofence_distance_m=geofence_distance_m,
            same_device_claims_24h=recent_hash_counts["same_device_claims_24h"],
            same_ip_claims_1h=recent_hash_counts["same_ip_claims_1h"],
            same_upi_claims_24h=recent_hash_counts["same_upi_claims_24h"],
            device_integrity_score=req.device_integrity_score,
            cluster_flagged=cluster_flagged,
        )
        fraud_alert_triggered = status in ("Hold", "Rejected")

        if status == "Approved" and await check_zone_payout_cap_prisma(
            prisma_db,
            zone=req.zone,
            baseline_per_day=ZONE_BASELINE_PAYOUTS_PER_DAY,
            cap_multiplier=ZONE_PAYOUT_CAP_MULTIPLIER,
            pending_approved=approved_this_request,
        ):
            status = "Hold"
            explanation = (
                f"Zone payout cap reached in {req.zone}; claim moved to manual review. "
                f"{explanation}"
            )

        created = await create_claim_event_with_wallet_tx(
            prisma_db,
            policy_id=policy.id,
            driver_id=driver.id,
            zone=req.zone,
            trigger_type=req.event_type,
            payout_amount=req.amount_per_claim,
            frs1=frs1,
            frs2=frs2,
            frs3=frs3,
            signal_breakdown=signal_breakdown,
            explanation=explanation,
            status=status,
            driver_lat=req.location.lat if req.location else None,
            driver_lon=req.location.lon if req.location else None,
            device_hash=device_hash,
            ip_hash=ip_hash,
            upi_hash=upi_hash,
            cluster_flagged=cluster_flagged,
            data_hash=None,
            driver_name=driver.fullName,
        )
        claim = created["claim"]
        if status == "Approved":
            approved_this_request += 1
        metric_events.append((status, fraud_alert_triggered))

        processed.append({
            "policy_id": policy.id,
            "driver_id": driver.id,
            "status": status,
            "frs": frs3,
            "fraudRiskScore": frs3,
            "transaction_id": created["transaction_id"],
            "transaction_hash": created["transaction_hash"],
            "tokenId": created["token_id"],
            "data_hash": claim.dataHash,
        })

    response = {
        "message": f"Simulated '{req.event_type}' in {req.zone}.",
        "driverId": requested_driver_id,
        "location": req.location.model_dump() if req.location else None,
        "policies": len(active_policies),
        "processed": processed,
    }
    if len(processed) == 1:
        response.update({
            "status": processed[0]["status"].lower(),
            "fraudRiskScore": processed[0]["fraudRiskScore"],
            "tokenId": processed[0]["tokenId"],
        })
    for metric_status, metric_fraud_alert in metric_events:
        record_claim_metrics(status=metric_status, fraud_alert=metric_fraud_alert)
    return response


class EventLocation(BaseModel):
    lat: float
    lon: float


class EventTriggerRequest(BaseModel):
    zone: str
    event_type: str = Field(validation_alias=AliasChoices("event_type", "eventType"))
    amount_per_claim: float = Field(
        validation_alias=AliasChoices("amount_per_claim", "amountPerClaim")
    )
    driver_id: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("driver_id", "driverId"),
    )
    location: Optional[EventLocation] = None
    timestamp: Optional[datetime.datetime] = None
    device_id: Optional[str] = Field(default=None, validation_alias=AliasChoices("device_id", "deviceId"))
    upi_id: Optional[str] = Field(default=None, validation_alias=AliasChoices("upi_id", "upiId"))
    device_integrity_score: float = Field(
        default=0.0,
        validation_alias=AliasChoices("device_integrity_score", "deviceIntegrityScore"),
    )

    model_config = ConfigDict(populate_by_name=True)


@app.post("/simulate-event")
async def simulate_event(
    req: EventTriggerRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_auth: dict = Depends(get_auth_context),
    prisma_db: Optional[Any] = Depends(get_prisma_dependency),
):
    """
    Event Replay Mode: inject a disruption event for a zone or driver.
    Fraud scoring still runs in full; this bypasses only external trigger discovery.
    """
    if prisma_db is not None:
        return await _simulate_event_prisma(req, request, db, current_auth, prisma_db)

    req.zone = _normalize_zone(req.zone)
    if req.driver_id is not None:
        _authorize_user_scope(current_auth, req.driver_id)

    requested_driver_id = req.driver_id or current_auth.get("user_id")
    users_query = db.query(models.User).filter(models.User.zone == req.zone)
    if requested_driver_id is not None:
        users_query = users_query.filter(models.User.id == requested_driver_id)

    users_in_zone   = users_query.all()
    user_ids        = [u.id for u in users_in_zone]
    active_policies = db.query(models.Policy).filter(
        models.Policy.user_id.in_(user_ids),
        models.Policy.active_status == True,
        models.Policy.end_date >= datetime.datetime.utcnow(),
    ).all()

    if not active_policies:
        raise HTTPException(status_code=404, detail="No active policies found for the requested zone/driver")

    processed = []
    metric_events: list[tuple[str, bool]] = []
    approved_this_request = 0
    thirty_min_ago = datetime.datetime.utcnow() - datetime.timedelta(minutes=30)
    recent_count   = (
        db.query(models.Claim)
          .filter(models.Claim.policy_id.in_([p.id for p in active_policies]),
                  models.Claim.timestamp >= thirty_min_ago)
          .count()
    )
    request_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    device_id = req.device_id or request.headers.get("X-Device-ID")
    upi_id = req.upi_id or request.headers.get("X-UPI-ID")
    ip_hash = hash_identifier(request_ip)
    device_hash = hash_identifier(device_id)
    upi_hash = hash_identifier(upi_id)
    recent_hash_counts = _recent_claim_counts_for_hashes(
        db,
        ip_hash=ip_hash,
        device_hash=device_hash,
        upi_hash=upi_hash,
    )
    zone_lat, zone_lon = ZONE_COORDS.get(req.zone, ZONE_COORDS["Zone A"])
    geofence_distance_m = None
    if req.location:
        geofence_distance_m = _distance_meters(req.location.lat, req.location.lon, zone_lat, zone_lon)

    for policy in active_policies:
        user = db.query(models.User).filter(models.User.id == policy.user_id).first()
        if not user:
            continue

        week_ago = datetime.datetime.utcnow() - datetime.timedelta(days=7)
        weekly_claims = (
            db.query(models.Claim)
              .join(models.Policy)
              .filter(models.Policy.user_id == user.id, models.Claim.timestamp >= week_ago)
              .count()
        )

        cluster_flagged = any([
            recent_hash_counts["same_device_claims_24h"] > 2,
            recent_hash_counts["same_ip_claims_1h"] > 2,
            recent_hash_counts["same_upi_claims_24h"] > 1,
        ])

        frs1, frs2, frs3, status, explanation, tx_id, agent_logs, signal_breakdown = await asyncio.to_thread(
            evaluate_fraud_multipass,
            zone=req.zone,
            event_type=req.event_type,
            user_id=user.id,
            weekly_income=float(user.weekly_income),
            payout_amount=req.amount_per_claim,
            claim_count_this_week=weekly_claims,
            same_zone_claims_30min=recent_count,
            geofence_distance_m=geofence_distance_m,
            same_device_claims_24h=recent_hash_counts["same_device_claims_24h"],
            same_ip_claims_1h=recent_hash_counts["same_ip_claims_1h"],
            same_upi_claims_24h=recent_hash_counts["same_upi_claims_24h"],
            device_integrity_score=req.device_integrity_score,
            cluster_flagged=cluster_flagged,
        )
        fraud_alert_triggered = status in ("Hold", "Rejected")

        if status == "Approved" and _check_zone_payout_cap(
            req.zone,
            db,
            pending_approved=approved_this_request,
        ):
            status = "Hold"
            tx_id = None
            explanation = (
                f"Zone payout cap reached in {req.zone}; claim moved to manual review. "
                f"{explanation}"
            )
            agent_logs.append({
                "step": "ZONE_CAP",
                "message": f"Auto-ceiling applied in {req.zone}; payout held for manual review.",
            })

        claim = models.Claim(
            policy_id=policy.id,
            trigger_type=req.event_type,
            payout_amount=req.amount_per_claim if status != "Rejected" else 0.0,
            frs1=frs1,
            frs2=frs2,
            frs3=frs3,
            frs_location=signal_breakdown["frs_location"],
            frs_device=signal_breakdown["frs_device"],
            frs_behavior=signal_breakdown["frs_behavior"],
            frs_network=signal_breakdown["frs_network"],
            frs_event=signal_breakdown["frs_event"],
            explanation=explanation,
            status=status,
            rain_mm_at_trigger=None,
            aqi_at_trigger=None,
            driver_lat=req.location.lat if req.location else None,
            driver_lon=req.location.lon if req.location else None,
            device_hash=device_hash,
            ip_address_hash=ip_hash,
            upi_hash=upi_hash or user.upi_hash,
            cluster_flagged=cluster_flagged,
        )
        db.add(claim)
        db.flush()
        claim.token_id = claim.id

        if status == "Approved" and tx_id == "PENDING_PAYOUT":
            payout_result = initiate_payout(user.name, req.amount_per_claim, claim_id=claim.id)
            tx_id = payout_result.get("transaction_hash") or payout_result.get("transaction_id")
            approved_this_request += 1
        claim.transaction_id = tx_id
        _attach_claim_hash(
            claim,
            zone=req.zone,
            event_type=req.event_type,
            location=req.location.model_dump() if req.location else None,
            driver_id=user.id,
        )

        for log in agent_logs:
            db.add(models.AgentLog(
                claim_id=claim.id,
                step=log["step"],
                log_message=log["message"]
            ))

        _log_audit(
            db,
            actor_role="admin" if current_auth["is_admin"] else "user",
            actor_id=str(current_auth.get("user_id") or 0),
            action="simulate_event",
            target_type="claim",
            target_id=str(claim.id),
            metadata={
                "zone": req.zone,
                "status": status,
                "token_id": claim.token_id,
                "request_id": getattr(request.state, "request_id", None),
            },
        )
        metric_events.append((status, fraud_alert_triggered))

        processed.append({
            "policy_id": policy.id,
            "driver_id": user.id,
            "status": status,
            "frs": frs3,
            "fraudRiskScore": frs3,
            "transaction_id": tx_id,
            "transaction_hash": tx_id,
            "tokenId": claim.token_id,
            "data_hash": claim.data_hash,
        })

    db.commit()
    for metric_status, metric_fraud_alert in metric_events:
        record_claim_metrics(status=metric_status, fraud_alert=metric_fraud_alert)
    response = {
        "message":   f"Simulated '{req.event_type}' in {req.zone}.",
        "driverId": requested_driver_id,
        "location": req.location.model_dump() if req.location else None,
        "policies":  len(active_policies),
        "processed": processed,
    }
    if len(processed) == 1:
        response.update({
            "status": processed[0]["status"].lower(),
            "fraudRiskScore": processed[0]["fraudRiskScore"],
            "tokenId": processed[0]["tokenId"],
        })
    return response
