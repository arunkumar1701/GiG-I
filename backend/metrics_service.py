"""
metrics_service.py
------------------
Prometheus counters for GiG-I business workflow events.
"""

from prometheus_client import Counter

claims_approved_total = Counter(
    "claims_approved_total",
    "Total number of claims approved by the platform.",
)

claims_rejected_total = Counter(
    "claims_rejected_total",
    "Total number of claims rejected by the platform.",
)

fraud_alerts_triggered = Counter(
    "fraud_alerts_triggered",
    "Total number of fraud alerts triggered by the fraud engine.",
)


def record_claim_metrics(*, status: str, fraud_alert: bool = False) -> None:
    normalized = (status or "").strip().lower()
    if normalized == "approved":
        claims_approved_total.inc()
    elif normalized == "rejected":
        claims_rejected_total.inc()

    if fraud_alert:
        fraud_alerts_triggered.inc()
