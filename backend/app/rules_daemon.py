import asyncio
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models import Policy, Claim, User

async def run_parametric_loop():
    while True:
        await asyncio.sleep(8)
        pass # Background HTTPX polling omitted for demo MVP scope

def trigger_payout_sync(trigger_type: str, amount_inr: float):
    db: Session = SessionLocal()
    try:
        active_policies = db.query(Policy).filter(Policy.is_active == True).all()
        for policy in active_policies:
            claim = Claim(policy_id=policy.id, trigger_type=trigger_type, payout_amount=amount_inr)
            db.add(claim)
            user = db.query(User).filter(User.id == policy.user_id).first()
            if user: user.wallet_balance += amount_inr
        db.commit()
    except Exception as e:
        print(f"Payout sync failed: {e}")
        db.rollback()
    finally:
        db.close()
