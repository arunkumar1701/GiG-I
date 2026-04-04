import asyncio
from app.database import SessionLocal
from app.models import Policy, Claim, User

async def rules_engine_daemon() -> None:
    while True:
        await asyncio.sleep(10)
        try:
            precipitation_mmh = fetch_external_weather() 
            if precipitation_mmh > 15.0:
                await asyncio.to_thread(execute_payout, "Heavy_Rain", 500.0)

            app_status = fetch_platform_status()
            if app_status == 503:
                await asyncio.to_thread(execute_payout, "App_Outage", 800.0)

            urban_speed_kmh = fetch_traffic_telemetry()
            if urban_speed_kmh < 8.0:
                await asyncio.to_thread(execute_payout, "Urban_Gridlock", 400.0)
        except Exception:
            pass

def execute_payout(trigger_type: str, amount: float) -> None:
    db = SessionLocal()
    try:
        active_policies = db.query(Policy).filter(Policy.is_active == True).all()
        for policy in active_policies:
            claim = Claim(policy_id=policy.id, trigger_type=trigger_type, payout_amount=amount)
            db.add(claim)
            user = db.query(User).filter(User.id == policy.user_id).first()
            if user:
                user.wallet_balance += amount
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def fetch_external_weather() -> float: return 0.0
def fetch_platform_status() -> int: return 200
def fetch_traffic_telemetry() -> float: return 20.0
