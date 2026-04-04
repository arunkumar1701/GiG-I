from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    mobile_number = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    vehicle_type = Column(String, nullable=False)
    base_zone = Column(String, nullable=False)
    avg_hourly_wage = Column(Float, nullable=False)
    wallet_balance = Column(Float, default=0.0, nullable=False)
    policies = relationship("Policy", back_populates="user")

class Policy(Base):
    __tablename__ = "policies"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_date = Column(DateTime, nullable=False)
    weekly_premium = Column(Float, nullable=False)
    predicted_lost_hours = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    user = relationship("User", back_populates="policies")
    claims = relationship("Claim", back_populates="policy")

class Claim(Base):
    __tablename__ = "claims"
    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(Integer, ForeignKey("policies.id"), nullable=False)
    trigger_type = Column(String, nullable=False)
    payout_amount = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    policy = relationship("Policy", back_populates="claims")
