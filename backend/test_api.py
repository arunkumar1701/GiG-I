import itertools
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


def _build_test_client(monkeypatch, tmp_path):
    db_path = tmp_path / 'test_api.db'
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

    monkeypatch.setattr(backend_main.scheduler, 'add_job', lambda *args, **kwargs: None)
    monkeypatch.setattr(backend_main.scheduler, 'start', lambda *args, **kwargs: None)
    monkeypatch.setattr(backend_main.scheduler, 'shutdown', lambda *args, **kwargs: None)
    monkeypatch.setattr(
        backend_main,
        'calculate_premium',
        lambda *args, **kwargs: (149.5, ['Deterministic test premium'], 6.5),
    )
    monkeypatch.setattr(
        backend_main,
        'get_weather',
        lambda zone: {
            'zone': zone,
            'rain_mm_per_hr': 7.5,
            'temp_c': 31.0,
            'weather_code': 502,
            'description': 'test rain',
            'trigger': 'Heavy Rain',
        },
    )
    monkeypatch.setattr(
        backend_main,
        'initiate_payout',
        lambda user_name, amount_inr, claim_id: {
            'transaction_id': f'RZP_TEST_{next(tx_counter):04d}',
            'amount_inr': amount_inr,
            'status': 'sandbox',
            'razorpay_order_id': f'order_{claim_id}',
        },
    )

    backend_main.app.dependency_overrides[backend_main.get_db] = override_get_db
    client = TestClient(backend_main.app)
    return client, TestingSessionLocal


def _login_admin(client):
    response = client.post('/admin/login', json={
        'username': backend_security.ADMIN_USERNAME,
        'password': backend_security.ADMIN_PASSWORD,
        'otp': backend_security.current_admin_totp_for_testing(),
    })
    assert response.status_code == 200
    return {'Authorization': f'Bearer {response.json()["access_token"]}'}


def test_api_register_quote_policy_event_wallet_and_ledger(monkeypatch, tmp_path):
    monkeypatch.setattr(
        backend_main,
        'evaluate_fraud_multipass',
        lambda **kwargs: (
            0.05,
            0.08,
            0.08,
            'Approved',
            'Auto-approved in test.',
            'PENDING_PAYOUT',
            [{'step': 'DECISION', 'message': 'Approved in test.'}],
            {
                'frs_location': 0.05,
                'frs_device': 0.05,
                'frs_behavior': 0.10,
                'frs_network': 0.05,
                'frs_event': 0.05,
            },
        ),
    )
    client, TestingSessionLocal = _build_test_client(monkeypatch, tmp_path)

    register = client.post('/register', json={
        'name': 'Ravi Kumar',
        'city': 'Chennai',
        'zone': 'Zone A',
        'platform': 'Swiggy',
        'weekly_income': 4500,
        'plan_tier': 'Standard',
        'phone': '9999999999',
    })
    assert register.status_code == 200
    auth = register.json()
    token = auth['access_token']
    refresh_token = auth['refresh_token']
    user_id = auth['user_id']
    user_headers = {'Authorization': f'Bearer {token}'}
    assert refresh_token

    session = TestingSessionLocal()
    stored_user = session.query(models.User).filter(models.User.id == user_id).first()
    assert stored_user.phone == '******9999'
    assert stored_user.phone_hash
    assert stored_user.phone_encrypted
    session.close()

    login = client.post('/login', json={'phone': '9999999999'})
    assert login.status_code == 200
    assert login.json()['user_id'] == user_id

    refresh = client.post('/token/refresh', json={'refresh_token': refresh_token})
    assert refresh.status_code == 200
    assert refresh.json()['user_id'] == user_id
    assert refresh.json()['access_token']

    quote = client.get(f'/quote/{user_id}', headers=user_headers)
    assert quote.status_code == 200
    assert quote.json()['premium'] == 149.5

    policy = client.post('/policy/create', json={
        'user_id': user_id,
        'premium_amount': quote.json()['premium'],
    }, headers=user_headers)
    assert policy.status_code == 200

    event = client.post('/simulate-event', json={
        'zone': 'Zone A',
        'eventType': 'Heavy Rain',
        'amountPerClaim': 500,
        'driverId': user_id,
        'location': {'lat': 13.08, 'lon': 80.27},
    }, headers=user_headers)
    assert event.status_code == 200
    event_json = event.json()
    assert event_json['driverId'] == user_id
    assert event_json['location'] == {'lat': 13.08, 'lon': 80.27}
    assert event_json['processed'][0]['transaction_id'].startswith('RZP_TEST_')
    assert event_json['processed'][0]['data_hash']

    wallet = client.get(f'/wallet/{user_id}', headers=user_headers)
    assert wallet.status_code == 200
    wallet_json = wallet.json()
    assert wallet_json['driverId'] == user_id
    assert wallet_json['balanceTokens'] == 500.0
    assert wallet_json['transactions'][0]['transactionId'].startswith('RZP_TEST_')

    dashboard = client.get(f'/user/{user_id}/dashboard', headers=user_headers)
    assert dashboard.status_code == 200
    assert dashboard.json()['claims'][0]['data_hash']

    admin_headers = _login_admin(client)
    ledger = client.get('/ledger', headers=admin_headers)
    assert ledger.status_code == 200
    ledger_entry = ledger.json()['entries'][0]
    assert ledger_entry['driverId'] == user_id
    assert ledger_entry['dataHash']
    assert ledger_entry['tokenId'] == 1

    metrics = client.get('/admin/metrics', headers=admin_headers)
    assert metrics.status_code == 200
    assert metrics.json()['counts']['claims'] == 1

    prometheus_metrics = client.get('/metrics')
    assert prometheus_metrics.status_code == 200
    assert 'claims_approved_total' in prometheus_metrics.text
    assert 'fraud_alerts_triggered' in prometheus_metrics.text


def test_phone_otp_request_and_verify(monkeypatch, tmp_path):
    client, _ = _build_test_client(monkeypatch, tmp_path)

    otp_request = client.post('/auth/otp/request', json={'phone': '9999999999'})
    assert otp_request.status_code == 200
    payload = otp_request.json()
    assert payload['phoneMasked'] == '******9999'
    assert payload['expiresInSeconds'] == 300
    assert payload['demoOtp']

    otp_verify = client.post('/auth/otp/verify', json={
        'phone': '9999999999',
        'otp': payload['demoOtp'],
    })
    assert otp_verify.status_code == 200
    assert otp_verify.json()['verified'] is True


def test_api_admin_review_approves_hold_claim(monkeypatch, tmp_path):
    monkeypatch.setattr(
        backend_main,
        'evaluate_fraud_multipass',
        lambda **kwargs: (
            0.60,
            0.68,
            0.68,
            'Hold',
            'Held for manual review.',
            None,
            [{'step': 'DECISION', 'message': 'Held for review.'}],
            {
                'frs_location': 0.60,
                'frs_device': 0.55,
                'frs_behavior': 0.45,
                'frs_network': 0.50,
                'frs_event': 0.60,
            },
        ),
    )
    client, _ = _build_test_client(monkeypatch, tmp_path)

    register = client.post('/register', json={
        'name': 'Meera',
        'city': 'Chennai',
        'zone': 'Zone A',
        'platform': 'Zomato',
        'weekly_income': 3800,
        'phone': '8888888888',
    })
    auth = register.json()
    user_id = auth['user_id']
    user_headers = {'Authorization': f'Bearer {auth["access_token"]}'}
    admin_headers = _login_admin(client)

    client.post('/policy/create', json={'user_id': user_id, 'premium_amount': 120}, headers=user_headers)
    simulate = client.post('/simulate-event', json={
        'zone': 'Zone A',
        'eventType': 'Heavy Rain',
        'amountPerClaim': 500,
        'driverId': user_id,
        'location': {'lat': 13.08, 'lon': 80.27},
    }, headers=user_headers)
    claim_id = simulate.json()['processed'][0]['policy_id']

    dashboard = client.get('/admin/dashboard', headers=admin_headers)
    claim = dashboard.json()['claims'][0]
    assert claim['status'] == 'Hold'
    assert claim['payout_amount'] == 500.0

    review = client.post(f"/admin/review/{claim['id']}", json={'decision': 'Approve'}, headers=admin_headers)
    assert review.status_code == 200
    assert review.json()['transaction_id'].startswith('RZP_TEST_')


def test_api_zone_payout_cap_moves_excess_claims_to_hold(monkeypatch, tmp_path):
    monkeypatch.setattr(
        backend_main,
        'evaluate_fraud_multipass',
        lambda **kwargs: (
            0.05,
            0.08,
            0.08,
            'Approved',
            'Auto-approved in test.',
            'PENDING_PAYOUT',
            [{'step': 'DECISION', 'message': 'Approved in test.'}],
            {
                'frs_location': 0.05,
                'frs_device': 0.05,
                'frs_behavior': 0.10,
                'frs_network': 0.05,
                'frs_event': 0.05,
            },
        ),
    )
    client, _ = _build_test_client(monkeypatch, tmp_path)
    backend_main.ZONE_BASELINE_PAYOUTS_PER_DAY['Zone A'] = 1

    register = client.post('/register', json={
        'name': 'Akash',
        'city': 'Chennai',
        'zone': 'Zone A',
        'platform': 'Swiggy',
        'weekly_income': 4200,
        'phone': '7777777777',
    })
    auth = register.json()
    user_id = auth['user_id']
    user_headers = {'Authorization': f'Bearer {auth["access_token"]}'}
    client.post('/policy/create', json={'user_id': user_id, 'premium_amount': 130}, headers=user_headers)

    first = client.post('/simulate-event', json={
        'zone': 'Zone A',
        'eventType': 'Heavy Rain',
        'amountPerClaim': 500,
        'driverId': user_id,
        'location': {'lat': 13.08, 'lon': 80.27},
    }, headers=user_headers)
    second = client.post('/simulate-event', json={
        'zone': 'Zone A',
        'eventType': 'Heavy Rain',
        'amountPerClaim': 500,
        'driverId': user_id,
        'location': {'lat': 13.08, 'lon': 80.27},
    }, headers=user_headers)
    third = client.post('/simulate-event', json={
        'zone': 'Zone A',
        'eventType': 'Heavy Rain',
        'amountPerClaim': 500,
        'driverId': user_id,
        'location': {'lat': 13.08, 'lon': 80.27},
    }, headers=user_headers)

    assert first.json()['processed'][0]['status'] == 'Approved'
    assert second.json()['processed'][0]['status'] == 'Approved'
    assert third.json()['processed'][0]['status'] == 'Hold'
