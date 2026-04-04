from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class UserCreate(BaseModel):
    mobile_number: str
    full_name: str
    vehicle_type: str
    base_zone: str
    avg_hourly_wage: float

class UserResponse(UserCreate):
    id: int
    wallet_balance: float
    class Config:
        from_attributes = True

class PolicyCreate(BaseModel):
    user_id: int
    weekly_premium: float
    predicted_lost_hours: float

class PolicyResponse(BaseModel):
    id: int
    user_id: int
    start_date: datetime
    end_date: datetime
    weekly_premium: float
    predicted_lost_hours: float
    is_active: bool
    class Config:
        from_attributes = True

class ClaimResponse(BaseModel):
    id: int
    trigger_type: str
    payout_amount: float
    timestamp: datetime
    class Config:
        from_attributes = True
