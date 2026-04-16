import itertools
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
os.environ["APP_ENV"] = "test"

import main as backend_main
import models


def test_zone_monitor_creates_approved_claim_for_active_policy(monkeypatch, tmp_path):
    db_path = tmp_path / 'monitor.db'
    engine = create_engine(
        f'sqlite:///{db_path}',
        connect_args={'check_same_thread': False},
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)

    monkeypatch.setattr(backend_main, 'SessionLocal', TestingSessionLocal)
    tx_counter = itertools.count(1)
    monkeypatch.setattr(
        backend_main,
        'get_weather',
        lambda zone: {
            'zone': zone,
            'rain_mm_per_hr': 9.0,
            'temp_c': 29.0,
            'weather_code': 502,
            'description': 'test monitor rain',
            'trigger': 'Heavy Rain' if zone == 'Zone A' else None,
        },
    )
    monkeypatch.setattr(
        backend_main,
        'evaluate_fraud_multipass',
        lambda **kwargs: (
            0.05,
            0.08,
            0.08,
            'Approved',
            'Auto-approved by monitor test.',
            'PENDING_PAYOUT',
            [{'step': 'DECISION', 'message': 'Approved during monitor test.'}],
            {
                'frs_location': 0.05,
                'frs_device': 0.05,
                'frs_behavior': 0.10,
                'frs_network': 0.05,
                'frs_event': 0.05,
            },
        ),
    )
    monkeypatch.setattr(
        backend_main,
        'initiate_payout',
        lambda user_name, amount_inr, claim_id: {
            'transaction_id': f'MONITOR_TX_{next(tx_counter):04d}',
            'amount_inr': amount_inr,
            'status': 'sandbox',
            'razorpay_order_id': f'order_{claim_id}',
        },
    )

    session = TestingSessionLocal()
    user = models.User(
        name='Scheduled Rider',
        city='Chennai',
        zone='Zone A',
        platform='Swiggy',
        weekly_income=4200,
        phone='7777000000',
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    policy = models.Policy(
        user_id=user.id,
        end_date=backend_main.datetime.datetime.utcnow() + backend_main.datetime.timedelta(days=3),
        premium_amount=150.0,
        active_status=True,
    )
    session.add(policy)
    session.commit()
    session.close()

    backend_main.monitor_state['last_run'] = None
    backend_main.monitor_state['last_triggers'] = []
    backend_main.monitor_state['total_auto_claims'] = 0

    backend_main.run_zone_monitor()

    session = TestingSessionLocal()
    claims = session.query(models.Claim).all()
    assert len(claims) == 1
    claim = claims[0]
    assert claim.status == 'Approved'
    assert claim.transaction_id.startswith('MONITOR_TX_')
    assert claim.data_hash
    assert backend_main.monitor_state['total_auto_claims'] == 1
    assert backend_main.monitor_state['last_triggers'][0]['zone'] == 'Zone A'
    session.close()
