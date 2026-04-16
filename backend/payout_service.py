"""
payout_service.py
-----------------
Handles payout execution:
- Web3 token minting in production mode
- Razorpay sandbox/local fallback for development and tests
"""

from __future__ import annotations

import logging
import uuid

from blockchain_service import mint_gigshield_tokens, queue_failed_payout
from settings import settings

logger = logging.getLogger(__name__)

RAZORPAY_KEY_ID = settings.razorpay_key_id
RAZORPAY_KEY_SECRET = settings.razorpay_key_secret
_SANDBOX_READY = (
    RAZORPAY_KEY_ID.startswith("rzp_test_")
    and RAZORPAY_KEY_SECRET not in ("", "placeholder_secret")
)


def initiate_payout(user_name: str, amount_inr: float, claim_id: int) -> dict:
    """
    Execute payout using configured backend mode.

    Returns:
        {
          "transaction_id": str,
          "transaction_hash": str | None,
          "amount_inr": float,
          "status": "simulated" | "sandbox" | "onchain_submitted" | "queued_for_retry",
          "razorpay_order_id": str | None
        }
    """
    if settings.enable_web3_payout:
        return _web3_payout(user_name, amount_inr, claim_id)

    if _SANDBOX_READY:
        return _razorpay_payout(user_name, amount_inr, claim_id)
    return _fallback_payout(amount_inr, claim_id)


def _web3_payout(user_name: str, amount_inr: float, claim_id: int) -> dict:
    try:
        tx = mint_gigshield_tokens(amount_tokens=amount_inr, claim_id=claim_id)
        return {
            "transaction_id": tx["transaction_id"],
            "transaction_hash": tx["transaction_hash"],
            "amount_inr": amount_inr,
            "status": tx["status"],
            "razorpay_order_id": None,
        }
    except Exception as exc:
        logger.exception("[PayoutService] Web3 mint failed for claim %s; queueing retry.", claim_id)
        queue_id = queue_failed_payout(
            {
                "claim_id": claim_id,
                "user_name": user_name,
                "amount_inr": amount_inr,
                "error": str(exc),
            }
        )
        queued_tx = f"QUEUED_{claim_id:06d}_{uuid.uuid4().hex[:8].upper()}"
        return {
            "transaction_id": queued_tx,
            "transaction_hash": None,
            "amount_inr": amount_inr,
            "status": "queued_for_retry",
            "retry_queue_id": queue_id,
            "razorpay_order_id": None,
        }


def _razorpay_payout(user_name: str, amount_inr: float, claim_id: int) -> dict:
    """Real Razorpay sandbox payout."""
    try:
        import razorpay

        client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

        order = client.order.create(
            {
                "amount": int(amount_inr * 100),  # Razorpay takes paise
                "currency": "INR",
                "receipt": f"claim_{claim_id}",
                "notes": {
                    "rider": user_name,
                    "claim_id": str(claim_id),
                    "product": "GiG-I Parametric Insurance",
                },
            }
        )

        tx_id = order.get("id", f"rzp_{uuid.uuid4().hex[:12]}")
        logger.info("[PayoutService] Razorpay sandbox order created: %s for INR %s", tx_id, amount_inr)
        return {
            "transaction_id": tx_id,
            "transaction_hash": None,
            "amount_inr": amount_inr,
            "status": "sandbox",
            "razorpay_order_id": tx_id,
        }

    except Exception as exc:
        logger.error("[PayoutService] Razorpay call failed: %s. Using fallback.", exc)
        return _fallback_payout(amount_inr, claim_id)


def _fallback_payout(amount_inr: float, claim_id: int) -> dict:
    """Deterministic fallback when Web3/Razorpay are not configured."""
    tx_id = f"TXN_{claim_id:06d}_{uuid.uuid4().hex[:8].upper()}"
    logger.info("[PayoutService] Fallback payout simulated: %s for INR %s", tx_id, amount_inr)
    return {
        "transaction_id": tx_id,
        "transaction_hash": None,
        "amount_inr": amount_inr,
        "status": "simulated",
        "razorpay_order_id": None,
    }
