import os

import pytest


@pytest.fixture
async def prisma_test_db_override():
    """
    Optional dependency override for Prisma-backed endpoint tests.
    Use by setting PRISMA_TEST_DB_URL to a temporary test database URL.
    """
    test_db_url = os.getenv("PRISMA_TEST_DB_URL")
    if not test_db_url:
        yield None
        return

    try:
        from prisma import Prisma
    except Exception as exc:  # pragma: no cover - only used in prisma integration tests
        pytest.skip(f"Prisma client is unavailable: {exc}")

    os.environ["DATABASE_URL"] = test_db_url
    db = Prisma()
    await db.connect()

    import main as backend_main
    from prisma_client import get_prisma_dependency

    async def _override():
        return db

    backend_main.app.dependency_overrides[get_prisma_dependency] = _override
    try:
        yield db
    finally:
        backend_main.app.dependency_overrides.pop(get_prisma_dependency, None)
        await db.disconnect()
