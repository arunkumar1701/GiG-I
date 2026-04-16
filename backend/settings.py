"""
settings.py
-----------
Centralized application settings with strict production validation.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")


def _env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None:
        return default
    value = value.strip()
    return value if value else default


def _bool_env(name: str, default: bool = False) -> bool:
    value = _env(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def _csv_env(name: str, default: str) -> list[str]:
    value = _env(name, default) or ""
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_env: str
    enable_prisma: bool
    database_url: str
    jwt_secret: str
    jwt_algorithm: str
    jwt_access_expire_minutes: int
    jwt_refresh_expire_days: int
    admin_demo_token: str
    allow_demo_admin_token: bool
    admin_username: str
    admin_password: str
    admin_totp_secret: str
    data_encryption_key: str
    openweather_api_key: str
    datagov_api_key: str
    gemini_api_key: str
    razorpay_key_id: str
    razorpay_key_secret: str
    redis_url: str
    otp_provider: str
    otp_demo_mode: bool
    otp_ttl_seconds: int
    fast2sms_api_key: str
    fast2sms_sender_id: str
    fast2sms_template_id: str
    twilio_account_sid: str
    twilio_auth_token: str
    twilio_verify_service_sid: str
    admin_phone_number: str
    enable_web3_payout: bool
    web3_rpc_url: str
    web3_chain_id: int
    web3_private_key: str
    web3_token_contract: str
    web3_default_recipient: str
    web3_token_decimals: int
    web3_gas_limit: int
    payout_retry_queue_key: str
    cors_allow_origins: list[str]
    allowed_hosts: list[str]
    rain_trigger_mm: float
    heat_trigger_c: float

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @classmethod
    def load(cls) -> "Settings":
        app_env = (_env("APP_ENV", "development") or "development").lower()
        is_production = app_env == "production"
        is_test_env = app_env in {"test", "testing"}

        default_sqlite = f"sqlite:///{(BASE_DIR / 'insurance.db').as_posix()}"

        def with_mode_default(name: str, default: str = "") -> str:
            value = _env(name)
            if value is not None:
                return value
            return "" if is_production else default

        database_url = _env("DB_URL") or _env("DATABASE_URL")
        if is_test_env:
            database_url = default_sqlite
        elif not database_url and not is_production:
            database_url = default_sqlite

        settings = cls(
            app_env=app_env,
            enable_prisma=_bool_env("ENABLE_PRISMA", is_production),
            database_url=database_url or "",
            jwt_secret=with_mode_default("JWT_SECRET", "gig-i-super-secret-jwt-key-2026-safe"),
            jwt_algorithm=_env("JWT_ALGORITHM", "HS256") or "HS256",
            jwt_access_expire_minutes=int(_env("JWT_ACCESS_EXPIRE_MINUTES", "15") or "15"),
            jwt_refresh_expire_days=int(_env("JWT_REFRESH_EXPIRE_DAYS", "7") or "7"),
            admin_demo_token=with_mode_default("ADMIN_DEMO_TOKEN", "admin-token"),
            allow_demo_admin_token=_bool_env("ALLOW_DEMO_ADMIN_TOKEN", False),
            admin_username=with_mode_default("ADMIN_USERNAME", "gigadmin"),
            admin_password=with_mode_default("ADMIN_PASSWORD", "Admin123!Secure"),
            admin_totp_secret=with_mode_default("ADMIN_TOTP_SECRET", "JBSWY3DPEHPK3PXP"),
            data_encryption_key=with_mode_default("DATA_ENCRYPTION_KEY", ""),
            openweather_api_key=with_mode_default("OPENWEATHER_API_KEY", ""),
            datagov_api_key=with_mode_default("DATAGOV_API_KEY", ""),
            gemini_api_key=with_mode_default("GEMINI_API_KEY", ""),
            razorpay_key_id=with_mode_default("RAZORPAY_KEY_ID", ""),
            razorpay_key_secret=with_mode_default("RAZORPAY_KEY_SECRET", ""),
            redis_url=with_mode_default("REDIS_URL", ""),
            otp_provider=(_env("OTP_PROVIDER", "demo") or "demo").lower(),
            otp_demo_mode=_bool_env("OTP_DEMO_MODE", not is_production),
            otp_ttl_seconds=int(_env("OTP_TTL_SECONDS", "300") or "300"),
            fast2sms_api_key=with_mode_default("FAST2SMS_API_KEY", ""),
            fast2sms_sender_id=with_mode_default("FAST2SMS_SENDER_ID", ""),
            fast2sms_template_id=with_mode_default("FAST2SMS_TEMPLATE_ID", ""),
            twilio_account_sid=with_mode_default("TWILIO_ACCOUNT_SID", ""),
            twilio_auth_token=with_mode_default("TWILIO_AUTH_TOKEN", ""),
            twilio_verify_service_sid=with_mode_default("TWILIO_VERIFY_SERVICE_SID", ""),
            admin_phone_number=with_mode_default("ADMIN_PHONE_NUMBER", ""),
            enable_web3_payout=_bool_env("ENABLE_WEB3_PAYOUT", is_production),
            web3_rpc_url=with_mode_default("WEB3_RPC_URL", ""),
            web3_chain_id=int(_env("WEB3_CHAIN_ID", "80002") or "80002"),
            web3_private_key=with_mode_default("PRIVATE_KEY", ""),
            web3_token_contract=with_mode_default("GIGSHIELD_TOKEN_ADDRESS", ""),
            web3_default_recipient=with_mode_default("WEB3_DEFAULT_RECIPIENT", ""),
            web3_token_decimals=int(_env("WEB3_TOKEN_DECIMALS", "18") or "18"),
            web3_gas_limit=int(_env("WEB3_GAS_LIMIT", "250000") or "250000"),
            payout_retry_queue_key=_env("PAYOUT_RETRY_QUEUE_KEY", "gigi:payout:retry") or "gigi:payout:retry",
            cors_allow_origins=_csv_env(
                "CORS_ALLOW_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
            ),
            allowed_hosts=_csv_env("ALLOWED_HOSTS", "*"),
            rain_trigger_mm=float(_env("RAIN_TRIGGER_MM_PER_HR", "2.7") or "2.7"),
            heat_trigger_c=float(_env("HEAT_TRIGGER_CELSIUS", "40.0") or "40.0"),
        )
        settings.validate()
        return settings

    def validate(self) -> None:
        if not self.is_production:
            return

        required = {
            "DB_URL": self.database_url,
            "JWT_SECRET": self.jwt_secret,
            "ADMIN_USERNAME": self.admin_username,
            "ADMIN_PASSWORD": self.admin_password,
            "ADMIN_TOTP_SECRET": self.admin_totp_secret,
            "DATA_ENCRYPTION_KEY": self.data_encryption_key,
            "OPENWEATHER_API_KEY": self.openweather_api_key,
            "DATAGOV_API_KEY": self.datagov_api_key,
            "GEMINI_API_KEY": self.gemini_api_key,
            "RAZORPAY_KEY_ID": self.razorpay_key_id,
            "RAZORPAY_KEY_SECRET": self.razorpay_key_secret,
            "REDIS_URL": self.redis_url,
        }
        if self.otp_provider == "demo":
            raise RuntimeError("OTP_PROVIDER cannot be demo in production")
        if self.otp_provider == "fast2sms":
            required.update(
                {
                    "FAST2SMS_API_KEY": self.fast2sms_api_key,
                    "FAST2SMS_SENDER_ID": self.fast2sms_sender_id,
                    "FAST2SMS_TEMPLATE_ID": self.fast2sms_template_id,
                    "ADMIN_PHONE_NUMBER": self.admin_phone_number,
                }
            )
        elif self.otp_provider == "twilio":
            required.update(
                {
                    "TWILIO_ACCOUNT_SID": self.twilio_account_sid,
                    "TWILIO_AUTH_TOKEN": self.twilio_auth_token,
                    "TWILIO_VERIFY_SERVICE_SID": self.twilio_verify_service_sid,
                    "ADMIN_PHONE_NUMBER": self.admin_phone_number,
                }
            )
        elif self.otp_provider != "demo":
            raise RuntimeError("OTP_PROVIDER must be one of: demo, fast2sms, twilio")
        if self.enable_web3_payout:
            required.update(
                {
                    "WEB3_RPC_URL": self.web3_rpc_url,
                    "PRIVATE_KEY": self.web3_private_key,
                    "GIGSHIELD_TOKEN_ADDRESS": self.web3_token_contract,
                }
            )

        missing = [name for name, value in required.items() if not value]
        if missing:
            raise RuntimeError(
                "Missing required production environment variables: "
                + ", ".join(sorted(missing))
            )

        insecure_defaults = {
            "JWT_SECRET": {"gig-i-super-secret-jwt-key-2026-safe", "changeme"},
            "ADMIN_USERNAME": {"gigadmin", "admin"},
            "ADMIN_PASSWORD": {"admin123!secure", "changeme"},
            "ADMIN_TOTP_SECRET": {"jbswy3dpehpk3pxp", "changeme"},
            "DATAGOV_API_KEY": {"placeholder_optional", "changeme"},
            "OPENWEATHER_API_KEY": {"changeme"},
            "GEMINI_API_KEY": {"changeme"},
            "RAZORPAY_KEY_ID": {"changeme"},
            "RAZORPAY_KEY_SECRET": {"changeme", "placeholder_secret"},
            "DATA_ENCRYPTION_KEY": {"changeme"},
            "PRIVATE_KEY": {"changeme", "replace-with-private-key"},
            "GIGSHIELD_TOKEN_ADDRESS": {"changeme", "0x0000000000000000000000000000000000000000"},
            "WEB3_RPC_URL": {"changeme", "https://example-rpc-url"},
        }
        normalized_values = {
            "JWT_SECRET": self.jwt_secret.strip().lower(),
            "ADMIN_USERNAME": self.admin_username.strip().lower(),
            "ADMIN_PASSWORD": self.admin_password.strip().lower(),
            "ADMIN_TOTP_SECRET": self.admin_totp_secret.strip().lower(),
            "DATAGOV_API_KEY": self.datagov_api_key.strip().lower(),
            "OPENWEATHER_API_KEY": self.openweather_api_key.strip().lower(),
            "GEMINI_API_KEY": self.gemini_api_key.strip().lower(),
            "RAZORPAY_KEY_ID": self.razorpay_key_id.strip().lower(),
            "RAZORPAY_KEY_SECRET": self.razorpay_key_secret.strip().lower(),
            "DATA_ENCRYPTION_KEY": self.data_encryption_key.strip().lower(),
            "FAST2SMS_API_KEY": self.fast2sms_api_key.strip().lower(),
            "FAST2SMS_SENDER_ID": self.fast2sms_sender_id.strip().lower(),
            "FAST2SMS_TEMPLATE_ID": self.fast2sms_template_id.strip().lower(),
            "TWILIO_ACCOUNT_SID": self.twilio_account_sid.strip().lower(),
            "TWILIO_AUTH_TOKEN": self.twilio_auth_token.strip().lower(),
            "TWILIO_VERIFY_SERVICE_SID": self.twilio_verify_service_sid.strip().lower(),
            "ADMIN_PHONE_NUMBER": self.admin_phone_number.strip().lower(),
            "PRIVATE_KEY": self.web3_private_key.strip().lower(),
            "GIGSHIELD_TOKEN_ADDRESS": self.web3_token_contract.strip().lower(),
            "WEB3_RPC_URL": self.web3_rpc_url.strip().lower(),
        }
        if not self.enable_web3_payout:
            normalized_values.pop("PRIVATE_KEY", None)
            normalized_values.pop("GIGSHIELD_TOKEN_ADDRESS", None)
            normalized_values.pop("WEB3_RPC_URL", None)
        if self.otp_provider != "fast2sms":
            normalized_values.pop("FAST2SMS_API_KEY", None)
            normalized_values.pop("FAST2SMS_SENDER_ID", None)
            normalized_values.pop("FAST2SMS_TEMPLATE_ID", None)
        if self.otp_provider != "twilio":
            normalized_values.pop("TWILIO_ACCOUNT_SID", None)
            normalized_values.pop("TWILIO_AUTH_TOKEN", None)
            normalized_values.pop("TWILIO_VERIFY_SERVICE_SID", None)
        if self.otp_provider == "demo":
            normalized_values.pop("ADMIN_PHONE_NUMBER", None)
        weak = [
            name for name, value in normalized_values.items()
            if value in insecure_defaults.get(name, set())
        ]
        if weak:
            raise RuntimeError(
                "Production environment variables contain insecure placeholder/default values: "
                + ", ".join(sorted(weak))
            )

        if self.web3_token_decimals < 0:
            raise RuntimeError("WEB3_TOKEN_DECIMALS must be non-negative")
        if self.web3_gas_limit <= 0:
            raise RuntimeError("WEB3_GAS_LIMIT must be greater than zero")



settings = Settings.load()

# Prisma uses DATABASE_URL by convention. Keep this synchronized with DB_URL.
os.environ.setdefault("DATABASE_URL", settings.database_url)
