"""
schemas.py — GiG-I Pydantic Schemas
Updated for Phase 2 MVP with individual FRS signals and telemetry fields.
"""

import re
from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
import datetime


def _validate_indian_mobile(value: Optional[str], field_name: str = "phone") -> Optional[str]:
    """
    Accept:
      - 10-digit Indian mobile starting with 6-9   e.g. 9876543210
      - +91 followed by 10-digit number            e.g. +919876543210
    Reject anything else.
    """
    if value is None or value.strip() == "":
        return value
    digits = re.sub(r"[^\d]", "", value)          # strip spaces, +, dashes
    if digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]                        # strip country code
    if len(digits) != 10:
        raise ValueError(f"{field_name} must be a 10-digit Indian mobile number (got '{value}')")
    if not re.match(r"^[6-9]\d{9}$", digits):
        raise ValueError(f"{field_name} must start with 6, 7, 8, or 9 (Indian mobile)")
    return digits                                  # always store as bare 10 digits


class UserCreate(BaseModel):
    name:          str
    city:          str
    zone:          str
    platform:      str
    weekly_income: float
    vehicle_type:  Optional[str] = "Bike"
    vehicle_number: Optional[str] = None
    plan_tier:     Optional[str] = "Standard"
    phone:         Optional[str] = None
    upi_id:        Optional[str] = None
    bank_name:     Optional[str] = None
    bank_account_number: Optional[str] = None
    ifsc_code:     Optional[str] = None
    emergency_contact: Optional[str] = None

    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v):
        return _validate_indian_mobile(v, "phone")

    @field_validator("emergency_contact", mode="before")
    @classmethod
    def validate_emergency_contact(cls, v):
        return _validate_indian_mobile(v, "emergency_contact")



class UserResponse(UserCreate):
    id: int
    phone: Optional[str] = None
    upi_id: Optional[str] = None
    bank_account_last4: Optional[str] = None
    has_upi: bool = False
    emergency_contact_masked: Optional[str] = None
    shift_status: Optional[str] = "Offline"

    # Override parent validators — UserResponse holds already-masked/stored values
    # (e.g. "******6780") so re-validating them as raw mobile numbers would crash.
    @field_validator("phone", mode="before")
    @classmethod
    def validate_phone(cls, v):
        return v  # already masked — skip validation

    @field_validator("emergency_contact", mode="before")
    @classmethod
    def validate_emergency_contact(cls, v):
        return v  # already masked — skip validation

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


# ── Phase 3: Shift & Telemetry Schemas ──────────────────────────────────────

class ShiftStartRequest(BaseModel):
    lat: float
    lon: float
    accuracy_m: Optional[float] = None


class TelemetryPingRequest(BaseModel):
    lat: float
    lon: float
    accuracy_m: Optional[float] = None
    speed_kmh: Optional[float] = None
    heading: Optional[float] = None


class ShiftStatusResponse(BaseModel):
    shift_id: Optional[int] = None
    is_active: bool = False
    started_at: Optional[datetime.datetime] = None
    last_ping_at: Optional[datetime.datetime] = None
    ping_count: int = 0
    last_lat: Optional[float] = None
    last_lon: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)
