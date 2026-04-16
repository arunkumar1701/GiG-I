"""
schemas.py — GiG-I Pydantic Schemas
Updated for Phase 2 MVP with individual FRS signals and telemetry fields.
"""

from pydantic import BaseModel, ConfigDict
from typing import Optional
import datetime


class UserCreate(BaseModel):
    name:          str
    city:          str
    zone:          str
    platform:      str
    weekly_income: float
    vehicle_type:  Optional[str] = "Bike"
    plan_tier:     Optional[str] = "Standard"
    phone:         Optional[str] = None
    upi_id:        Optional[str] = None


class UserResponse(UserCreate):
    id: int
    phone: Optional[str] = None
    upi_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user_id: int
    user: UserResponse


class PolicyCreate(BaseModel):
    user_id:        int
    premium_amount: float


class PolicyResponse(BaseModel):
    id:             int
    user_id:        int
    start_date:     datetime.datetime
    end_date:       datetime.datetime
    premium_amount: float
    active_status:  bool
    model_config = ConfigDict(from_attributes=True)


class ClaimResponse(BaseModel):
    id:             int
    policy_id:      int
    trigger_type:   str
    payout_amount:  float
    timestamp:      datetime.datetime

    # Aggregate FRS
    frs1:           Optional[float] = None
    frs2:           Optional[float] = None
    frs3:           Optional[float] = None

    # Individual signal breakdown
    frs_location:   Optional[float] = None
    frs_device:     Optional[float] = None
    frs_behavior:   Optional[float] = None
    frs_network:    Optional[float] = None
    frs_event:      Optional[float] = None

    # Telemetry
    rain_mm_at_trigger: Optional[float] = None
    aqi_at_trigger:     Optional[float] = None
    driver_lat:         Optional[float] = None
    driver_lon:         Optional[float] = None
    device_hash:        Optional[str] = None
    ip_address_hash:    Optional[str] = None
    upi_hash:           Optional[str] = None
    token_id:           Optional[int] = None
    cluster_flagged:    Optional[bool] = None

    # Decision
    explanation:        Optional[str]   = None
    status:             Optional[str]   = None
    transaction_id:     Optional[str]   = None
    transaction_hash:   Optional[str]   = None
    data_hash:          Optional[str]   = None
    reviewed_by_admin:  Optional[bool]  = None
    review_notes:       Optional[str]   = None

    model_config = ConfigDict(from_attributes=True)


class AgentLogResponse(BaseModel):
    id:          int
    claim_id:    Optional[int] = None
    timestamp:   datetime.datetime
    step:        str
    log_message: str
    model_config = ConfigDict(from_attributes=True)


class AuditLogResponse(BaseModel):
    id: int
    actor_role: str
    actor_id: Optional[str] = None
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    status: str
    metadata_json: Optional[str] = None
    timestamp: datetime.datetime
    model_config = ConfigDict(from_attributes=True)
