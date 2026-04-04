from pydantic import BaseModel
from typing import List, Optional
import datetime

class UserCreate(BaseModel):
    name: str
    city: str
    zone: str
    platform: str
    weekly_income: float

class UserResponse(UserCreate):
    id: int
    class Config:
        from_attributes = True

class PolicyCreate(BaseModel):
    user_id: int
    premium_amount: float

class PolicyResponse(BaseModel):
    id: int
    user_id: int
    start_date: datetime.datetime
    end_date: datetime.datetime
    premium_amount: float
    active_status: bool
    class Config:
        from_attributes = True

class ClaimResponse(BaseModel):
    id: int
    policy_id: int
    trigger_type: str
    payout_amount: float
    timestamp: datetime.datetime
    frs1: Optional[float] = None
    frs2: Optional[float] = None
    frs3: Optional[float] = None
    explanation: Optional[str] = None
    status: Optional[str] = None
    transaction_id: Optional[str] = None
    class Config:
        from_attributes = True

class AgentLogResponse(BaseModel):
    id: int
    claim_id: Optional[int] = None
    timestamp: datetime.datetime
    step: str
    log_message: str
    class Config:
        from_attributes = True
