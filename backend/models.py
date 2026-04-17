"""
models.py — GiG-I SQLAlchemy ORM Models
Updated for Phase 3: WorkerShift + TelemetryPing tables for real GPS tracking.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String, index=True)
    city           = Column(String)
    zone           = Column(String)
    platform       = Column(String)
    weekly_income  = Column(Float)
    vehicle_type   = Column(String, default="Bike")
    vehicle_number = Column(String, nullable=True)
    plan_tier      = Column(String, default="Standard")   # Basic / Standard / Premium
    shift_status   = Column(String, default="Offline")
    phone          = Column(String, nullable=True)
    phone_hash     = Column(String, nullable=True, index=True)
    phone_encrypted = Column(String, nullable=True)
    upi_hash       = Column(String, nullable=True, index=True)
    upi_encrypted  = Column(String, nullable=True)
    bank_name      = Column(String, nullable=True)
    bank_account_last4 = Column(String, nullable=True)
    bank_account_hash = Column(String, nullable=True, index=True)
    bank_account_encrypted = Column(String, nullable=True)
    ifsc_hash      = Column(String, nullable=True)
    ifsc_encrypted = Column(String, nullable=True)
    emergency_contact = Column(String, nullable=True)
    emergency_contact_hash = Column(String, nullable=True)
    emergency_contact_encrypted = Column(String, nullable=True)

    policies = relationship("Policy", back_populates="user")
    shifts   = relationship("WorkerShift", back_populates="user")


class Policy(Base):
    __tablename__ = "policies"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"))
    start_date     = Column(DateTime, default=datetime.datetime.utcnow)
    end_date       = Column(DateTime)
    premium_amount = Column(Float)
    active_status  = Column(Boolean, default=True)

    user   = relationship("User", back_populates="policies")
    claims = relationship("Claim", back_populates="policy")


class Claim(Base):
    __tablename__ = "claims"

    id            = Column(Integer, primary_key=True, index=True)
    policy_id     = Column(Integer, ForeignKey("policies.id"))
    trigger_type  = Column(String)
    payout_amount = Column(Float)
    timestamp     = Column(DateTime, default=datetime.datetime.utcnow)

    # Aggregate FRS scores (Tier 1 / 2 / 3)
    frs1          = Column(Float, nullable=True)
    frs2          = Column(Float, nullable=True)
    frs3          = Column(Float, nullable=True)

    # Individual signal breakdown
    frs_location  = Column(Float, nullable=True)   # Location / trigger authenticity
    frs_device    = Column(Float, nullable=True)   # Device / claim frequency signal
    frs_behavior  = Column(Float, nullable=True)   # Payout-to-income ratio
    frs_network   = Column(Float, nullable=True)   # Collusion / network risk
    frs_event     = Column(Float, nullable=True)   # Event verification signal

    # Real telemetry captured at claim time
    rain_mm_at_trigger = Column(Float, nullable=True)
    aqi_at_trigger     = Column(Float, nullable=True)
    driver_lat         = Column(Float, nullable=True)
    driver_lon         = Column(Float, nullable=True)
    device_hash        = Column(String, nullable=True, index=True)
    ip_address_hash    = Column(String, nullable=True, index=True)
    upi_hash           = Column(String, nullable=True, index=True)
    token_id           = Column(Integer, nullable=True, index=True)
    cluster_flagged    = Column(Boolean, default=False)

    # Telemetry evidence signals (Phase 3)
    shift_id                 = Column(Integer, ForeignKey("worker_shifts.id"), nullable=True)
    telemetry_continuity     = Column(Float, nullable=True)  # 0-1, low = suspicious
    telemetry_speed_risk     = Column(Float, nullable=True)  # 0-1, high = spoofing
    telemetry_gps_stale      = Column(Float, nullable=True)  # 0-1, high = GPS vanished
    telemetry_accuracy_risk  = Column(Float, nullable=True)  # 0-1, high = poor accuracy
    telemetry_distance_km    = Column(Float, nullable=True)  # km traveled during shift
    telemetry_ping_count     = Column(Integer, nullable=True)

    # Decision fields
    explanation    = Column(String, nullable=True)
    status         = Column(String, default="Pending")
    transaction_id = Column(String, nullable=True)
    data_hash      = Column(String, nullable=True)

    # Admin manual review fields
    reviewed_by_admin = Column(Boolean, default=False)
    review_notes      = Column(String, nullable=True)

    policy = relationship("Policy", back_populates="claims")
    shift  = relationship("WorkerShift", back_populates="claims")


class WorkerShift(Base):
    """
    Tracks each discrete on-shift session for a worker.
    Created when worker taps 'Go Online', closed on 'Go Offline' or timeout.
    """
    __tablename__ = "worker_shifts"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), index=True)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    ended_at   = Column(DateTime, nullable=True)
    is_active  = Column(Boolean, default=True)
    # Snapshot of last known position (for claim filing)
    last_lat   = Column(Float, nullable=True)
    last_lon   = Column(Float, nullable=True)
    last_ping_at = Column(DateTime, nullable=True)

    user   = relationship("User", back_populates="shifts")
    pings  = relationship("TelemetryPing", back_populates="shift")
    claims = relationship("Claim", back_populates="shift")


class TelemetryPing(Base):
    """
    One GPS ping from the worker's browser during an active shift.
    Stored for fraud-signal computation at claim time.
    """
    __tablename__ = "telemetry_pings"

    id          = Column(Integer, primary_key=True, index=True)
    shift_id    = Column(Integer, ForeignKey("worker_shifts.id"), index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), index=True)
    lat         = Column(Float, nullable=False)
    lon         = Column(Float, nullable=False)
    accuracy_m  = Column(Float, nullable=True)   # GPS accuracy in metres
    speed_kmh   = Column(Float, nullable=True)   # Browser-reported speed
    heading     = Column(Float, nullable=True)   # Degrees 0-360
    timestamp   = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    shift = relationship("WorkerShift", back_populates="pings")


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id          = Column(Integer, primary_key=True, index=True)
    claim_id    = Column(Integer, nullable=True)
    timestamp   = Column(DateTime, default=datetime.datetime.utcnow)
    step        = Column(String)
    log_message = Column(String)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id            = Column(Integer, primary_key=True, index=True)
    actor_role    = Column(String)
    actor_id      = Column(String, nullable=True)
    action        = Column(String)
    target_type   = Column(String, nullable=True)
    target_id     = Column(String, nullable=True)
    status        = Column(String, default="success")
    metadata_json = Column(String, nullable=True)
    timestamp     = Column(DateTime, default=datetime.datetime.utcnow)
