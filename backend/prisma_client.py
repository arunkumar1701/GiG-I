"""
prisma_client.py
----------------
Async Prisma client lifecycle and FastAPI dependency helpers.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import HTTPException

from settings import settings

logger = logging.getLogger(__name__)

try:
    from prisma import Prisma
except Exception:  # pragma: no cover - optional import during local non-prisma runs
    Prisma = None  # type: ignore

_prisma: Optional[Any] = None


def prisma_enabled() -> bool:
    return settings.enable_prisma


def _ensure_prisma_available() -> None:
    if Prisma is None:
        raise RuntimeError(
            "Prisma client is not installed or generated. "
            "Install dependencies and run: python -m prisma generate --schema backend/prisma/schema.prisma"
        )


async def connect_prisma() -> None:
    global _prisma
    if not prisma_enabled():
        return
    _ensure_prisma_available()
    if _prisma is None:
        _prisma = Prisma()
    if not _prisma.is_connected():
        await _prisma.connect()
        logger.info("[Prisma] Connected.")


async def disconnect_prisma() -> None:
    global _prisma
    if _prisma is None:
        return
    if _prisma.is_connected():
        await _prisma.disconnect()
        logger.info("[Prisma] Disconnected.")


async def get_prisma_dependency() -> Optional[Any]:
    if not prisma_enabled():
        return None
    await connect_prisma()
    return _prisma


def require_prisma_enabled() -> None:
    if not prisma_enabled():
        raise HTTPException(status_code=503, detail="Prisma-backed mode is disabled")
