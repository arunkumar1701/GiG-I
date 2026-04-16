"""
otp_service.py
--------------
Gateway-ready OTP transport for worker and admin authentication.

Fast2SMS is treated as a stateless SMS transport, so this service generates
and verifies the code. Twilio Verify is treated as a stateful provider.
"""

from __future__ import annotations

import base64
import hmac
import logging
import secrets
import time
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from security import hash_identifier, mask_phone
from settings import settings

logger = logging.getLogger(__name__)


@dataclass
class OtpDispatchResult:
    phone_masked: str
    expires_in_seconds: int
    provider: str
    demo_otp: Optional[str] = None


class OtpService:
    def __init__(self) -> None:
        self._memory_cache: dict[str, tuple[str, float]] = {}
        self._redis = None
        if settings.redis_url:
            try:
                import redis.asyncio as redis_async

                self._redis = redis_async.from_url(settings.redis_url, decode_responses=True)
            except Exception as exc:  # pragma: no cover - defensive init
                logger.warning("Redis OTP cache unavailable, using process memory: %s", exc)

    @staticmethod
    def normalize_phone(phone: str) -> str:
        digits = "".join(ch for ch in phone if ch.isdigit())
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        if len(digits) != 10:
            raise ValueError("Enter a valid 10-digit Indian mobile number")
        return digits

    @staticmethod
    def _cache_key(phone: str, purpose: str) -> str:
        return f"otp:{purpose}:{hash_identifier(phone)}"

    @staticmethod
    def _generate_code() -> str:
        return f"{secrets.randbelow(900000) + 100000}"

    async def _cache_set(self, key: str, code: str) -> None:
        expires_at = time.time() + settings.otp_ttl_seconds
        if self._redis is not None:
            await self._redis.setex(key, settings.otp_ttl_seconds, code)
            return
        self._memory_cache[key] = (code, expires_at)

    async def _cache_get(self, key: str) -> Optional[str]:
        if self._redis is not None:
            return await self._redis.get(key)

        value = self._memory_cache.get(key)
        if not value:
            return None
        code, expires_at = value
        if expires_at <= time.time():
            self._memory_cache.pop(key, None)
            return None
        return code

    async def _cache_delete(self, key: str) -> None:
        if self._redis is not None:
            await self._redis.delete(key)
            return
        self._memory_cache.pop(key, None)

    async def send_otp(self, phone: str, purpose: str = "worker") -> OtpDispatchResult:
        normalized = self.normalize_phone(phone)
        provider = settings.otp_provider

        if provider == "twilio":
            await self._send_twilio_verify(normalized, purpose)
            return OtpDispatchResult(mask_phone(normalized) or "******", settings.otp_ttl_seconds, "twilio")

        code = self._generate_code()
        await self._cache_set(self._cache_key(normalized, purpose), code)

        if provider == "fast2sms":
            await self._send_fast2sms(normalized, code)
            return OtpDispatchResult(mask_phone(normalized) or "******", settings.otp_ttl_seconds, "fast2sms")

        return OtpDispatchResult(
            phone_masked=mask_phone(normalized) or "******",
            expires_in_seconds=settings.otp_ttl_seconds,
            provider="demo",
            demo_otp=code if settings.otp_demo_mode else None,
        )

    async def verify_otp(self, phone: str, otp_code: str, purpose: str = "worker") -> dict[str, Any]:
        normalized = self.normalize_phone(phone)
        code = otp_code.strip()
        if len(code) != 6 or not code.isdigit():
            raise ValueError("Enter the 6-digit OTP")

        if settings.otp_provider == "twilio":
            verified = await self._check_twilio_verify(normalized, code, purpose)
            if not verified:
                return {"verified": False, "phoneMasked": mask_phone(normalized)}
            return {"verified": True, "phoneMasked": mask_phone(normalized)}

        key = self._cache_key(normalized, purpose)
        cached_code = await self._cache_get(key)
        if not cached_code:
            return {"verified": False, "phoneMasked": mask_phone(normalized)}

        if not hmac.compare_digest(str(cached_code), code):
            return {"verified": False, "phoneMasked": mask_phone(normalized)}

        await self._cache_delete(key)
        return {"verified": True, "phoneMasked": mask_phone(normalized)}

    async def _send_fast2sms(self, phone: str, code: str) -> None:
        if not settings.fast2sms_api_key:
            if settings.otp_demo_mode:
                logger.warning("FAST2SMS_API_KEY missing; keeping OTP in demo cache only")
                return
            raise RuntimeError("FAST2SMS_API_KEY is required")

        payload = {
            "route": "dlt",
            "sender_id": settings.fast2sms_sender_id,
            "message": settings.fast2sms_template_id,
            "variables_values": code,
            "flash": "0",
            "numbers": phone,
        }
        headers = {"authorization": settings.fast2sms_api_key}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post("https://www.fast2sms.com/dev/bulkV2", data=payload, headers=headers)
            response.raise_for_status()

    async def _send_twilio_verify(self, phone: str, purpose: str) -> None:
        if not all([settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_verify_service_sid]):
            if settings.otp_demo_mode:
                code = self._generate_code()
                await self._cache_set(self._cache_key(phone, purpose), code)
                logger.warning("Twilio settings missing; generated demo %s OTP %s", purpose, code)
                return
            raise RuntimeError("Twilio Verify settings are required")

        url = (
            f"https://verify.twilio.com/v2/Services/"
            f"{settings.twilio_verify_service_sid}/Verifications"
        )
        auth_token = base64.b64encode(
            f"{settings.twilio_account_sid}:{settings.twilio_auth_token}".encode("utf-8")
        ).decode("ascii")
        headers = {
            "Authorization": f"Basic {auth_token}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, data={"To": f"+91{phone}", "Channel": "sms"}, headers=headers)
            response.raise_for_status()

    async def _check_twilio_verify(self, phone: str, code: str, purpose: str) -> bool:
        if not all([settings.twilio_account_sid, settings.twilio_auth_token, settings.twilio_verify_service_sid]):
            key = self._cache_key(phone, purpose)
            cached_code = await self._cache_get(key)
            if cached_code and hmac.compare_digest(cached_code, code):
                await self._cache_delete(key)
                return True
            return False

        url = (
            f"https://verify.twilio.com/v2/Services/"
            f"{settings.twilio_verify_service_sid}/VerificationCheck"
        )
        auth_token = base64.b64encode(
            f"{settings.twilio_account_sid}:{settings.twilio_auth_token}".encode("utf-8")
        ).decode("ascii")
        headers = {
            "Authorization": f"Basic {auth_token}",
            "Content-Type": "application/x-www-form-urlencoded",
        }
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(url, data={"To": f"+91{phone}", "Code": code}, headers=headers)
            response.raise_for_status()
            return response.json().get("status") == "approved"


otp_service = OtpService()
