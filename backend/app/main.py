import asyncio
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from pydantic import BaseModel

from app.database import engine, get_db, Base
from app import models, auth, ai_actuary, rules_daemon

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Guidewire MVP: Gig Parametric Architecture IAM")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_headers=["*"], allow_methods=["*"], allow_credentials=True)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(rules_daemon.run_parametric_loop())

pricer = ai_actuary.RiskEngine()

class OTPRequest(BaseModel): mobile_number: str
class OTPValidate(BaseModel): mobile_number: str; code: str; full_name: str; zone: str
class WebhookCall(BaseModel): trigger_type: str
class QuoteRequest(BaseModel): zone: str; hourly_wage: float

@app.post("/auth/request-otp")
def request_otp(payload: OTPRequest):
    return {"status": "success", "message": f"Simulated OTP sent to {payload.mobile_number}"}

@app.post("/auth/validate-otp")
def validate_otp(payload: OTPValidate, db: Session = Depends(get_db)):
    if payload.code != "1234":
        raise HTTPException(status_code=400, detail="Invalid Authorization Code")
    user = db.query(models.User).filter(models.User.mobile_number == payload.mobile_number).first()
    if not user:
        user = models.User(mobile_number=payload.mobile_number, full_name=payload.full_name, vehicle_type="Bike", base_zone=payload.zone, avg_hourly_wage=180.0)
        db.add(user)
        db.commit()
        db.refresh(user)
    token = auth.create_access_token(user.id)
    return {"access_token": token, "user": {"id": user.id, "name": user.full_name}}

@app.get("/api/dashboard")
def get_dashboard(user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    policy = db.query(models.Policy).filter(models.Policy.user_id == user.id, models.Policy.is_active == True).first()
    claims = db.query(models.Claim).filter(models.Claim.policy_id == (policy.id if policy else 0)).all()
    c_data = [{"trigger_type": c.trigger_type, "payout_amount": c.payout_amount, "timestamp": c.timestamp} for c in claims]
    return {
        "wallet_balance": user.wallet_balance, 
        "active_policy": policy, 
        "claims": c_data,
        "user_meta": {"base_zone": user.base_zone, "full_name": user.full_name, "mobile_number": user.mobile_number}
    }

@app.post("/api/quote")
def generate_quote(payload: QuoteRequest, user: models.User = Depends(auth.get_current_user)):
    premium, h_forecast = pricer.calculate_premium(payload.hourly_wage, payload.zone)
    return {"premium_inr": premium, "lost_hours": h_forecast, "avg_hourly_wage": payload.hourly_wage}

@app.post("/api/policy/buy")
def buy_policy(payload: QuoteRequest, user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    premium, h_forecast = pricer.calculate_premium(payload.hourly_wage, payload.zone)
    policy = models.Policy(user_id=user.id, end_date=datetime.utcnow() + timedelta(days=7), weekly_premium=premium, predicted_lost_hours=h_forecast)
    db.add(policy)
    # Update persistent configuration
    user.base_zone = payload.zone
    user.avg_hourly_wage = payload.hourly_wage
    user.vehicle_type = "Bike"
    db.commit()
    return {"status": "Active"}

@app.post("/api/wallet/withdraw")
def withdraw_wallet(user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    amount = user.wallet_balance
    user.wallet_balance = 0.0
    db.commit()
    return {"status": "Success", "amount": amount}

@app.post("/api/webhook/trigger")
async def trigger_webhook(payload: WebhookCall, user: models.User = Depends(auth.get_current_user)):
    triggers = {"Heavy_Rain": 500.0, "App_Outage": 800.0, "Gridlock": 400.0}
    if payload.trigger_type in triggers:
        await asyncio.to_thread(rules_daemon.trigger_payout_sync, payload.trigger_type, triggers[payload.trigger_type])
        return {"status": "Settled", "amount": triggers[payload.trigger_type]}
    raise HTTPException(status_code=400, detail="Invalid Trigger")
