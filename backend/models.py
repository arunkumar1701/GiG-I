from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    city = Column(String)
    zone = Column(String)
    platform = Column(String)
    weekly_income = Column(Float)
    policies = relationship("Policy", back_populates="user")

class Policy(Base):
    __tablename__ = "policies"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    start_date = Column(DateTime, default=datetime.datetime.utcnow)
    end_date = Column(DateTime)
    premium_amount = Column(Float)
    active_status = Column(Boolean, default=True)
    user = relationship("User", back_populates="policies")
    claims = relationship("Claim", back_populates="policy")

class Claim(Base):
    __tablename__ = "claims"
    id = Column(Integer, primary_key=True, index=True)
    policy_id = Column(Integer, ForeignKey("policies.id"))
    trigger_type = Column(String)
    payout_amount = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Phase 2 Advanced Fraud fields
    frs1 = Column(Float, nullable=True)
    frs2 = Column(Float, nullable=True)
    frs3 = Column(Float, nullable=True)
    explanation = Column(String, nullable=True)
    status = Column(String, default="Pending")
    transaction_id = Column(String, nullable=True)
    
    policy = relationship("Policy", back_populates="claims")

class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    step = Column(String)
    log_message = Column(String)
