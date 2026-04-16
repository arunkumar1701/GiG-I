"""
prisma_repository.py
--------------------
Prisma-backed repository helpers for claim simulation, wallet, and ledger.
"""

from __future__ import annotations

import datetime
from typing import Any, Optional

from fastapi import HTTPException

from payout_service import initiate_payout


async def get_active_policies_for_driver(prisma_db: Any, driver_id: int) -> list[Any]:
    now = datetime.datetime.utcnow()
    return await prisma_db.policy.find_many(
        where={
            "driverId": driver_id,
            "activeStatus": True,
            "endDate": {"gte": now},
        }
    )


async def count_recent_claims_for_driver(prisma_db: Any, driver_id: int, minutes: int) -> int:
    since = datetime.datetime.utcnow() - datetime.timedelta(minutes=minutes)
    return await prisma_db.claimevent.count(
        where={"driverId": driver_id, "timestamp": {"gte": since}}
    )


async def count_weekly_claims_for_driver(prisma_db: Any, driver_id: int) -> int:
    since = datetime.datetime.utcnow() - datetime.timedelta(days=7)
    return await prisma_db.claimevent.count(
        where={"driverId": driver_id, "timestamp": {"gte": since}}
    )


async def count_recent_hash_activity(
    prisma_db: Any,
    *,
    ip_hash: Optional[str],
    device_hash: Optional[str],
    upi_hash: Optional[str],
) -> dict:
    now = datetime.datetime.utcnow()
    one_hour_ago = now - datetime.timedelta(hours=1)
    one_day_ago = now - datetime.timedelta(hours=24)

    same_ip = 0
    same_device = 0
    same_upi = 0
    if ip_hash:
        same_ip = await prisma_db.claimevent.count(
            where={"ipAddressHash": ip_hash, "timestamp": {"gte": one_hour_ago}}
        )
    if device_hash:
        same_device = await prisma_db.claimevent.count(
            where={"deviceHash": device_hash, "timestamp": {"gte": one_day_ago}}
        )
    if upi_hash:
        same_upi = await prisma_db.claimevent.count(
            where={"upiHash": upi_hash, "timestamp": {"gte": one_day_ago}}
        )
    return {
        "same_ip_claims_1h": same_ip,
        "same_device_claims_24h": same_device,
        "same_upi_claims_24h": same_upi,
    }


async def check_zone_payout_cap_prisma(
    prisma_db: Any,
    *,
    zone: str,
    baseline_per_day: dict[str, int],
    cap_multiplier: float,
    pending_approved: int,
) -> bool:
    day_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    payouts_today = await prisma_db.claimevent.count(
        where={"zone": zone, "status": "Approved", "timestamp": {"gte": day_start}}
    )
    baseline = baseline_per_day.get(zone, 5)
    cap = int(baseline * cap_multiplier)
    return payouts_today + pending_approved >= cap


async def create_claim_event_with_wallet_tx(
    prisma_db: Any,
    *,
    policy_id: int,
    driver_id: int,
    zone: str,
    trigger_type: str,
    payout_amount: float,
    frs1: float,
    frs2: float,
    frs3: float,
    signal_breakdown: dict,
    explanation: str,
    status: str,
    driver_lat: Optional[float],
    driver_lon: Optional[float],
    device_hash: Optional[str],
    ip_hash: Optional[str],
    upi_hash: Optional[str],
    cluster_flagged: bool,
    data_hash: Optional[str],
    driver_name: str,
) -> dict:
    claim = await prisma_db.claimevent.create(
        data={
            "policyId": policy_id,
            "driverId": driver_id,
            "zone": zone,
            "triggerType": trigger_type,
            "payoutAmount": payout_amount if status != "Rejected" else 0.0,
            "frs1": frs1,
            "frs2": frs2,
            "frs3": frs3,
            "frsLocation": signal_breakdown.get("frs_location"),
            "frsDevice": signal_breakdown.get("frs_device"),
            "frsBehavior": signal_breakdown.get("frs_behavior"),
            "frsNetwork": signal_breakdown.get("frs_network"),
            "frsEvent": signal_breakdown.get("frs_event"),
            "explanation": explanation,
            "status": status,
            "driverLat": driver_lat,
            "driverLon": driver_lon,
            "deviceHash": device_hash,
            "ipAddressHash": ip_hash,
            "upiHash": upi_hash,
            "clusterFlagged": cluster_flagged,
            "dataHash": data_hash,
        }
    )

    token_id = claim.id
    transaction_id = None
    transaction_hash = None
    if status == "Approved":
        payout_result = initiate_payout(driver_name, payout_amount, claim_id=claim.id)
        transaction_hash = payout_result.get("transaction_hash")
        transaction_id = payout_result.get("transaction_id")

    stored_tx_ref = transaction_hash or transaction_id

    claim = await prisma_db.claimevent.update(
        where={"id": claim.id},
        data={"tokenId": token_id, "transactionId": stored_tx_ref},
    )

    if status == "Approved":
        await prisma_db.wallettransaction.create(
            data={
                "driverId": driver_id,
                "claimEventId": claim.id,
                "tokenId": token_id,
                "txType": "payout",
                "event": trigger_type,
                "amount": payout_amount,
                "transactionId": stored_tx_ref,
                "status": status,
            }
        )

    return {
        "claim": claim,
        "token_id": token_id,
        "transaction_id": transaction_id,
        "transaction_hash": transaction_hash,
    }


async def wallet_view(prisma_db: Any, driver_id: int) -> dict:
    driver = await prisma_db.driver.find_unique(where={"id": driver_id})
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    txs = await prisma_db.wallettransaction.find_many(
        where={"driverId": driver_id},
        order={"timestamp": "desc"},
        take=10,
    )
    balance = sum(float(tx.amount or 0) for tx in txs if (tx.status or "").lower() == "approved")
    transactions = [
        {
            "tokenId": tx.tokenId,
            "type": tx.txType,
            "event": tx.event,
            "amount": round(float(tx.amount or 0), 2),
            "timestamp": tx.timestamp.isoformat(),
            "transactionId": tx.transactionId,
            "transactionHash": tx.transactionId,
            "status": tx.status,
        }
        for tx in txs
    ]
    return {
        "driverId": driver_id,
        "balanceTokens": round(balance, 2),
        "transactions": transactions,
        "driver_name": driver.fullName,
        "zone": driver.zone,
    }


async def ledger_view(
    prisma_db: Any,
    *,
    status: Optional[str],
    zone: Optional[str],
    limit: int,
) -> dict:
    where: dict[str, Any] = {}
    if status:
        where["status"] = status
    if zone:
        where["zone"] = zone

    claims = await prisma_db.claimevent.find_many(
        where=where,
        include={"driver": True},
        order={"timestamp": "desc"},
        take=limit,
    )
    entries = [
        {
            "event": claim.triggerType,
            "driverId": claim.driverId,
            "driverName": claim.driver.fullName if claim.driver else "Unknown",
            "zone": claim.zone,
            "time": claim.timestamp.isoformat(),
            "tokenId": claim.tokenId or claim.id,
            "FRS": claim.frs3,
            "status": claim.status,
            "amount": round(float(claim.payoutAmount or 0), 2),
            "transactionId": claim.transactionId,
            "transactionHash": claim.transactionId,
            "dataHash": claim.dataHash,
        }
        for claim in claims
    ]
    return {
        "entries": entries,
        "total": len(entries),
        "filters": {"status": status, "zone": zone},
    }
