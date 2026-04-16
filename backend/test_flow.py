import itertools
import json
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
os.environ["APP_ENV"] = "test"

import main as backend_main
import models
import security as backend_security


def build_client():
    db_path = BACKEND_DIR / 'test_flow.db'
    if db_path.exists():
        db_path.unlink()

    engine = create_engine(
        f'sqlite:///{db_path}',
        connect_args={'check_same_thread': False},
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    tx_counter = itertools.count(1)
    backend_main.scheduler.add_job = lambda *args, **kwargs: None
    backend_main.scheduler.start = lambda *args, **kwargs: None
    backend_main.scheduler.shutdown = lambda *args, **kwargs: None
    backend_main.calculate_premium = lambda *args, **kwargs: (
        152.75,
        ['Flow script deterministic premium'],
        5.5,
    )
    backend_main.get_weather = lambda zone: {
        'zone': zone,
        'rain_mm_per_hr': 7.0,
        'temp_c': 30.0,
        'weather_code': 502,
        'description': 'scripted rain',
        'trigger': 'Heavy Rain',
    }
    backend_main.evaluate_fraud_multipass = lambda **kwargs: (
        0.05,
        0.08,
        0.08,
        'Approved',
        'Auto-approved in scripted flow.',
        'PENDING_PAYOUT',
        [{'step': 'DECISION', 'message': 'Approved in scripted flow.'}],
        {
            'frs_location': 0.05,
            'frs_device': 0.05,
            'frs_behavior': 0.10,
            'frs_network': 0.05,
            'frs_event': 0.05,
        },
    )
    backend_main.initiate_payout = lambda user_name, amount_inr, claim_id: {
        'transaction_id': f'FLOW_TX_{next(tx_counter):04d}',
        'amount_inr': amount_inr,
        'status': 'sandbox',
        'razorpay_order_id': f'flow_order_{claim_id}',
    }
    backend_main.app.dependency_overrides[backend_main.get_db] = override_get_db
    return TestClient(backend_main.app)


def main():
    client = build_client()

    user = client.post('/register', json={
        'name': 'Ravi Kumar',
        'city': 'Chennai',
        'zone': 'Zone A',
        'platform': 'Swiggy',
        'weekly_income': 4500,
        'plan_tier': 'Standard',
        'phone': '6666666666',
    }).json()
    token = user['access_token']
    user_id = user['user_id']
    user_headers = {'Authorization': f'Bearer {token}'}
    admin_login = client.post('/admin/login', json={
        'username': backend_security.ADMIN_USERNAME,
        'password': backend_security.ADMIN_PASSWORD,
        'otp': backend_security.current_admin_totp_for_testing(),
    }).json()
    admin_headers = {'Authorization': f'Bearer {admin_login["access_token"]}'}

    quote = client.get(f'/quote/{user_id}', headers=user_headers).json()
    policy = client.post('/policy/create', json={
        'user_id': user_id,
        'premium_amount': quote['premium'],
    }, headers=user_headers).json()
    event = client.post('/simulate-event', json={
        'zone': 'Zone A',
        'eventType': 'Heavy Rain',
        'amountPerClaim': 500.0,
        'driverId': user_id,
        'location': {'lat': 13.0827, 'lon': 80.2707},
    }, headers=user_headers).json()
    wallet = client.get(f'/wallet/{user_id}', headers=user_headers).json()
    ledger = client.get('/ledger', headers=admin_headers).json()

    print('REGISTER')
    print(json.dumps(user, indent=2))
    print('QUOTE')
    print(json.dumps(quote, indent=2))
    print('POLICY')
    print(json.dumps(policy, indent=2))
    print('EVENT')
    print(json.dumps(event, indent=2))
    print('WALLET')
    print(json.dumps(wallet, indent=2))
    print('LEDGER')
    print(json.dumps(ledger, indent=2))


if __name__ == '__main__':
    main()
