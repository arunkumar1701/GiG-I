"""
security.py
-----------
JWT Authentication, SHA-256 data hashing, and rate limiting middleware.
Implements README §18: Cybersecurity & Data Integrity Architecture.
"""

import base64
import secrets
import hashlib
import hmac
import time
import logging
from typing import Optional
from datetime import datetime, timedelta

from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import jwt
import pyotp
try:
    import redis
except Exception:  # pragma: no cover - optional dependency fallback
    redis = None

from settings import settings
logger = logging.getLogger(__name__)

DEFAULT_JWT_SECRET = "gig-i-super-secret-jwt-key-2026-safe"
DEFAULT_ADMIN_USERNAME = "gigadmin"
DEFAULT_ADMIN_PASSWORD = "Admin123!Secure"
DEFAULT_ADMIN_TOTP_SECRET = "JBSWY3DPEHPK3PXP"

JWT_SECRET = settings.jwt_secret
JWT_ALGORITHM = settings.jwt_algorithm
JWT_ACCESS_EXPIRE_MINUTES = settings.jwt_access_expire_minutes
JWT_REFRESH_EXPIRE_DAYS = settings.jwt_refresh_expire_days
ADMIN_DEMO_TOKEN = settings.admin_demo_token
ALLOW_DEMO_ADMIN_TOKEN = settings.allow_demo_admin_token
ADMIN_USERNAME = settings.admin_username
ADMIN_PASSWORD = settings.admin_password
ADMIN_TOTP_SECRET = settings.admin_totp_secret
DATA_ENCRYPTION_KEY = settings.data_encryption_key
REDIS_URL = settings.redis_url

# -----------------------------------------------------------------
# JWT
# -----------------------------------------------------------------

def _build_payload(user_id: int, role: str, token_type: str, expires_delta: timedelta) -> dict:
    now = datetime.utcnow()
    return {
        "sub": str(user_id),
        "role": role,
        "type": token_type,
        "jti": secrets.token_hex(12),
        "iat": now,
        "exp": now + expires_delta,
    }


def create_access_token(user_id: int, role: str = "user") -> str:
    payload = _build_payload(
        user_id,
        role,
        "access",
        timedelta(minutes=JWT_ACCESS_EXPIRE_MINUTES),
    )
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: int, role: str = "user") -> str:
    payload = _build_payload(
        user_id,
        role,
        "refresh",
        timedelta(days=JWT_REFRESH_EXPIRE_DAYS),
    )
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_token_pair(user_id: int, role: str = "user") -> dict:
    return {
        "access_token": create_access_token(user_id, role=role),
        "refresh_token": create_refresh_token(user_id, role=role),
        "token_type": "bearer",
    }


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        payload["sub"] = int(payload["sub"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def decode_access_token(token: str) -> dict:
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Access token required")
    return payload


def decode_refresh_token(token: str) -> dict:
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token required")
    return payload


def _get_aesgcm() -> AESGCM:
    if DATA_ENCRYPTION_KEY:
        padded = DATA_ENCRYPTION_KEY + "=" * (-len(DATA_ENCRYPTION_KEY) % 4)
        key = base64.urlsafe_b64decode(padded)
    else:
        key = hashlib.sha256(JWT_SECRET.encode("utf-8")).digest()
    return AESGCM(key[:32])


def encrypt_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    aesgcm = _get_aesgcm()
    nonce = secrets.token_bytes(12)
    encrypted = aesgcm.encrypt(nonce, value.encode("utf-8"), None)
    return base64.urlsafe_b64encode(nonce + encrypted).decode("utf-8")


def decrypt_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    raw = base64.urlsafe_b64decode(value.encode("utf-8"))
    nonce, ciphertext = raw[:12], raw[12:]
    aesgcm = _get_aesgcm()
    return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")


def hash_identifier(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return hashlib.sha256(value.strip().lower().encode("utf-8")).hexdigest()


def mask_phone(phone: Optional[str]) -> Optional[str]:
    if not phone:
        return None
    digits = "".join(ch for ch in phone if ch.isdigit())
    if len(digits) < 4:
        return "****"
    return f"******{digits[-4:]}"


def verify_admin_credentials(username: str, password: str, otp: str) -> None:
    if not hmac.compare_digest(username, ADMIN_USERNAME):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    if not hmac.compare_digest(password, ADMIN_PASSWORD):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    totp = pyotp.TOTP(ADMIN_TOTP_SECRET)
    if not totp.verify(otp, valid_window=1):
        raise HTTPException(status_code=401, detail="Invalid MFA code")


def current_admin_totp_for_testing() -> str:
    return pyotp.TOTP(ADMIN_TOTP_SECRET).now()


def get_security_posture() -> dict:
    warnings = []
    if JWT_SECRET == DEFAULT_JWT_SECRET:
        warnings.append("JWT secret uses the default value")
    if ADMIN_USERNAME == DEFAULT_ADMIN_USERNAME:
        warnings.append("Admin username uses the default value")
    if ADMIN_PASSWORD == DEFAULT_ADMIN_PASSWORD:
        warnings.append("Admin password uses the default value")
    if ADMIN_TOTP_SECRET == DEFAULT_ADMIN_TOTP_SECRET:
        warnings.append("Admin TOTP secret uses the default value")
    if not DATA_ENCRYPTION_KEY:
        warnings.append("Data encryption key is derived from JWT secret instead of a dedicated key")
    if ALLOW_DEMO_ADMIN_TOKEN:
        warnings.append("Legacy demo admin token is enabled")

    return {
        "access_token_minutes": JWT_ACCESS_EXPIRE_MINUTES,
        "refresh_token_days": JWT_REFRESH_EXPIRE_DAYS,
        "demo_admin_enabled": ALLOW_DEMO_ADMIN_TOKEN,
        "dedicated_data_encryption_key": bool(DATA_ENCRYPTION_KEY),
        "custom_jwt_secret": JWT_SECRET != DEFAULT_JWT_SECRET,
        "custom_admin_username": ADMIN_USERNAME != DEFAULT_ADMIN_USERNAME,
        "custom_admin_password": ADMIN_PASSWORD != DEFAULT_ADMIN_PASSWORD,
        "custom_admin_totp_secret": ADMIN_TOTP_SECRET != DEFAULT_ADMIN_TOTP_SECRET,
        "warnings": warnings,
        "production_ready": not warnings,
    }


security_scheme = HTTPBearer(auto_error=False)


def get_auth_context(
    credentials: HTTPAuthorizationCredentials = Security(security_scheme),
) -> dict:
    """Return the authenticated principal context for JWT or the demo admin token."""
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = credentials.credentials
    if ALLOW_DEMO_ADMIN_TOKEN and token == ADMIN_DEMO_TOKEN:
        return {"user_id": None, "role": "admin", "is_admin": True}

    payload = decode_access_token(token)
    return {
        "user_id": int(payload["sub"]),
        "role": payload.get("role", "user"),
        "is_admin": payload.get("role") == "admin",
    }


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Security(security_scheme),
) -> int:
    """Extract the authenticated end-user ID from a JWT bearer token."""
    context = get_auth_context(credentials)
    if context["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin token is not valid for user scope")
    return int(context["user_id"])


def require_admin(
    credentials: HTTPAuthorizationCredentials = Security(security_scheme),
) -> dict:
    """Require an admin principal."""
    context = get_auth_context(credentials)
    if not context["is_admin"]:
        raise HTTPException(status_code=403, detail="Admin access required")
    return context


# -----------------------------------------------------------------
# SHA-256 Data Integrity Hashing (README §18)
# -----------------------------------------------------------------

def hash_payload(data: str) -> str:
    """
    Hash GPS/sensor payload using SHA-256 before storage.
    Prevents post-event tampering of location history.
    """
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def hash_claim_data(
    claim_id: int,
    zone: str,
    event_type: str,
    timestamp: str,
    sensor_payload: Optional[str] = None,
) -> str:
    """Generate an immutable SHA-256 fingerprint for a claim record."""
    raw = f"{claim_id}|{zone}|{event_type}|{timestamp}"
    if sensor_payload:
        raw = f"{raw}|{sensor_payload}"
    return hash_payload(raw)


# -----------------------------------------------------------------
# Rate Limiting (README §18)
# -----------------------------------------------------------------

# In-memory store: { ip: [timestamp, ...] }
_rate_limit_store: dict = {}
RATE_LIMIT_WINDOW_SECONDS = 60
RATE_LIMIT_MAX_REQUESTS = 30  # per minute per IP
_redis_client = None
if REDIS_URL and redis:
    try:
        _redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.warning(f"[RateLimit] Redis init failed, falling back to in-memory store: {exc}")


def _rate_limit_check_redis(ip: str, now: float, window_start: float) -> None:
    if not _redis_client:
        return

    key = f"ratelimit:{ip}"
    member = f"{now}-{secrets.token_hex(4)}"
    try:
        pipe = _redis_client.pipeline(transaction=True)
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.zadd(key, {member: now})
        pipe.expire(key, RATE_LIMIT_WINDOW_SECONDS + 2)
        _, req_count, _, _ = pipe.execute()
        if int(req_count) >= RATE_LIMIT_MAX_REQUESTS:
            logger.warning(f"[RateLimit] IP {ip} exceeded {RATE_LIMIT_MAX_REQUESTS} req/min (redis)")
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Max {RATE_LIMIT_MAX_REQUESTS} requests per minute.",
            )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive fallback
        logger.warning(f"[RateLimit] Redis check failed, falling back to in-memory store: {exc}")
        _rate_limit_check_memory(ip, now, window_start)


def _rate_limit_check_memory(ip: str, now: float, window_start: float) -> None:
    if ip not in _rate_limit_store:
        _rate_limit_store[ip] = []

    # Prune old timestamps
    _rate_limit_store[ip] = [t for t in _rate_limit_store[ip] if t > window_start]

    if len(_rate_limit_store[ip]) >= RATE_LIMIT_MAX_REQUESTS:
        logger.warning(f"[RateLimit] IP {ip} exceeded {RATE_LIMIT_MAX_REQUESTS} req/min")
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Max {RATE_LIMIT_MAX_REQUESTS} requests per minute."
        )

    _rate_limit_store[ip].append(now)


def rate_limit_check(ip: str) -> None:
    """
    Basic sliding-window rate limiter.
    Raises HTTP 429 if the IP exceeds RATE_LIMIT_MAX_REQUESTS per minute.
    """
    now = time.time()
    window_start = now - RATE_LIMIT_WINDOW_SECONDS

    if _redis_client:
        _rate_limit_check_redis(ip, now, window_start)
        return
    _rate_limit_check_memory(ip, now, window_start)
