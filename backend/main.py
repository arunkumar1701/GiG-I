from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
import datetime

import models, schemas
from database import engine, get_db
from ai_engine import calculate_premium, evaluate_fraud_multipass

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Parametric Insurance API Phase 2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routes ---

@app.post("/register", response_model=schemas.UserResponse)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = models.User(**user.model_dump())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/quote/{user_id}")
def get_quote(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        premium, factors, hours = calculate_premium(user.weekly_income, user.zone, user.platform)
    except Exception as e:
        premium = 150.0  # Safe fallback
        factors = ["Fallback pricing used"]
        hours = 10.0
        
    return {
        "user_id": user_id, 
        "mock_premium": round(premium, 2),
        "ml_factors": factors,
        "lost_hours": hours
    }

@app.post("/policy/create", response_model=schemas.PolicyResponse)
def create_policy(policy: schemas.PolicyCreate, db: Session = Depends(get_db)):
    end_date = datetime.datetime.utcnow() + datetime.timedelta(days=7)
    db_policy = models.Policy(
        user_id=policy.user_id,
        end_date=end_date,
        premium_amount=policy.premium_amount
    )
    db.add(db_policy)
    db.commit()
    db.refresh(db_policy)
    return db_policy

# User Dashboard
@app.get("/user/{user_id}/dashboard")
def get_dashboard(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    policies = db.query(models.Policy).filter(models.Policy.user_id == user_id).all()
    active_policy = next((p for p in policies if p.active_status), None)
    
    claims = []
    total_balance = 0.0
    for p in policies:
        policy_claims = db.query(models.Claim).filter(models.Claim.policy_id == p.id).all()
        for c in policy_claims:
            claims.append(schemas.ClaimResponse.model_validate(c))
            if c.status == "Approved" and c.payout_amount:
                total_balance += float(c.payout_amount)
            
    return {
        "user_meta": {
             "full_name": user.name,
             "city": user.city,
             "zone": user.zone,
             "platform": user.platform,
             "weekly_income": user.weekly_income
         } if user else None,
        "active_policy": schemas.PolicyResponse.model_validate(active_policy) if active_policy else None,
        "wallet_balance": total_balance,
        "claims": claims
    }

class EventTriggerRequest(BaseModel):
    zone: str
    event_type: str
    amount_per_claim: float

# Event Replay & Multi-Pass Evaluation Trigger
@app.post("/simulate-event")
def simulate_event(req: EventTriggerRequest, db: Session = Depends(get_db)):
    # Find active policies in this zone
    users_in_zone = db.query(models.User).filter(models.User.zone == req.zone).all()
    user_ids = [u.id for u in users_in_zone]
    
    active_policies = db.query(models.Policy).filter(
        models.Policy.user_id.in_(user_ids),
        models.Policy.active_status == True
    ).all()
    
    processed_claims = []
    
    for policy in active_policies:
        # Evaluate Fraud using Multi-Pass logic
        frs1, frs2, frs3, status, explanation, tx_id, agent_logs = evaluate_fraud_multipass()
        
        claim = models.Claim(
            policy_id=policy.id,
            trigger_type=req.event_type,
            payout_amount=req.amount_per_claim,
            frs1=frs1,
            frs2=frs2,
            frs3=frs3,
            explanation=explanation,
            status=status,
            transaction_id=tx_id
        )
        db.add(claim)
        db.flush() # Get the claim ID quickly before full commit
        
        for log in agent_logs:
            agent_log_db = models.AgentLog(
                claim_id=claim.id,
                step=log["step"],
                log_message=log["message"]
            )
            db.add(agent_log_db)
        
    db.commit()
    
    return {"message": f"Simulated {req.event_type} in {req.zone}. Generated {len(active_policies)} claims."}

@app.get("/admin/dashboard")
def get_admin_dashboard(db: Session = Depends(get_db)):
    claims = db.query(models.Claim).order_by(models.Claim.timestamp.desc()).all()
    return {"claims": [schemas.ClaimResponse.model_validate(c) for c in claims]}

@app.get("/admin/agent-logs")
def get_agent_logs(db: Session = Depends(get_db)):
    logs = db.query(models.AgentLog).order_by(models.AgentLog.id.desc()).limit(150).all()
    return {"logs": [schemas.AgentLogResponse.model_validate(l) for l in logs]}
