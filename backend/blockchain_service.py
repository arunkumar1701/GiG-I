"""
blockchain_service.py
---------------------
Web3 mint integration for GigShield ERC-20 payouts.
"""

from __future__ import annotations

import json
import logging
import secrets
import time
from pathlib import Path
from typing import Any, Optional

from settings import settings

try:
    import redis
except Exception:  # pragma: no cover - optional fallback
    redis = None

try:
    from eth_account import Account
    from web3 import Web3
except Exception:  # pragma: no cover - optional fallback for local non-web3 tests
    Account = None
    Web3 = None

logger = logging.getLogger(__name__)

_MINT_ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"},
        ],
        "name": "mint",
        "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]

_retry_redis_client = None
if settings.redis_url and redis:
    try:
        _retry_redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.warning(f"[Blockchain] Redis retry queue init failed: {exc}")


def _retry_fallback_path() -> Path:
    return Path(__file__).resolve().parent / "payout_retry_queue.jsonl"


def queue_failed_payout(payload: dict[str, Any]) -> str:
    queue_id = f"RETRY_{int(time.time())}_{secrets.token_hex(4).upper()}"
    message = {
        "queue_id": queue_id,
        "queued_at": int(time.time()),
        **payload,
    }

    if _retry_redis_client:
        try:
            _retry_redis_client.rpush(settings.payout_retry_queue_key, json.dumps(message))
            return queue_id
        except Exception as exc:  # pragma: no cover - defensive fallback
            logger.warning(f"[Blockchain] Redis queue push failed, writing local fallback queue: {exc}")

    fallback = _retry_fallback_path()
    with fallback.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(message, separators=(",", ":")) + "\n")
    return queue_id


def mint_gigshield_tokens(
    *,
    amount_tokens: float,
    claim_id: int,
    recipient_override: Optional[str] = None,
) -> dict[str, Any]:
    if Web3 is None or Account is None:
        raise RuntimeError("web3.py is not installed; cannot perform on-chain minting")
    if not settings.web3_rpc_url:
        raise RuntimeError("WEB3_RPC_URL is missing")
    if not settings.web3_private_key:
        raise RuntimeError("PRIVATE_KEY is missing")
    if not settings.web3_token_contract:
        raise RuntimeError("GIGSHIELD_TOKEN_ADDRESS is missing")

    provider = Web3.HTTPProvider(settings.web3_rpc_url, request_kwargs={"timeout": 20})
    w3 = Web3(provider)
    if not w3.is_connected():
        raise RuntimeError("Unable to connect to Web3 RPC endpoint")

    signer = Account.from_key(settings.web3_private_key)
    recipient = recipient_override or settings.web3_default_recipient or signer.address
    recipient_checksum = w3.to_checksum_address(recipient)
    contract_address = w3.to_checksum_address(settings.web3_token_contract)
    contract = w3.eth.contract(address=contract_address, abi=_MINT_ABI)

    decimals_multiplier = 10 ** settings.web3_token_decimals
    mint_amount = int(round(amount_tokens * decimals_multiplier))
    nonce = w3.eth.get_transaction_count(signer.address, "pending")
    chain_id = settings.web3_chain_id or int(w3.eth.chain_id)

    tx = contract.functions.mint(recipient_checksum, mint_amount).build_transaction(
        {
            "from": signer.address,
            "nonce": nonce,
            "chainId": chain_id,
            "gas": settings.web3_gas_limit,
        }
    )

    latest_block = w3.eth.get_block("latest")
    base_fee = latest_block.get("baseFeePerGas")
    if base_fee is not None:
        priority_fee = w3.to_wei(2, "gwei")
        tx["maxPriorityFeePerGas"] = priority_fee
        tx["maxFeePerGas"] = int(base_fee * 2 + priority_fee)
    else:
        tx["gasPrice"] = int(w3.eth.gas_price)

    signed = signer.sign_transaction(tx)
    raw_tx = getattr(signed, "raw_transaction", None) or getattr(signed, "rawTransaction", None)
    tx_hash = w3.eth.send_raw_transaction(raw_tx)
    tx_hash_hex = w3.to_hex(tx_hash)

    logger.info(
        "[Blockchain] Mint submitted claim=%s amount=%s recipient=%s tx=%s",
        claim_id,
        amount_tokens,
        recipient_checksum,
        tx_hash_hex,
    )
    return {
        "transaction_hash": tx_hash_hex,
        "transaction_id": tx_hash_hex,
        "status": "onchain_submitted",
        "recipient": recipient_checksum,
        "chain_id": chain_id,
        "mint_amount_base_units": mint_amount,
    }
