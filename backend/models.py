"""
models.py — GiG-I SQLAlchemy ORM Models
Updated for Phase 2 MVP: individual FRS signal scores, real telemetry fields, admin review.
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
    plan_tier      = Column(String, default="Standard")   # Basic / Standard / Premium
    phone          = Column(String, nullable=True)
    phone_hash     = Column(String, nullable=True, index=True)
    phone_encrypted = Column(String, nullable=True)
    upi_hash       = Column(String, nullable=True, index=True)
    upi_encrypted  = Column(String, nullable=True)

    policies = relationship("Policy", back_populates="user")


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

    # Individual signal breakdown (NEW — replaces opaque random values)
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

    # Decision fields
    explanation    = Column(String, nullable=True)
    status         = Column(String, default="Pending")
    transaction_id = Column(String, nullable=True)
    data_hash      = Column(String, nullable=True)

    # Admin manual review fields
    reviewed_by_admin = Column(Boolean, default=False)
    review_notes      = Column(String, nullable=True)

    policy = relationship("Policy", back_populates="claims")


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
