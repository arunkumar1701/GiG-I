"""
db_migrate.py  --  Run once after Cloud SQL instance is created.
Creates all tables in the PostgreSQL database.

Usage:
  # Local (using Cloud SQL Auth Proxy):
  DB_URL=postgresql+psycopg2://gig_i_user:GiGi@Secure2026!@127.0.0.1:5432/gig_i_prod python db_migrate.py

  # Or with Cloud SQL connector env vars:
  CLOUD_SQL_CONNECTION_NAME=gig-i-a4fea:asia-south1:gig-i-db \
  DB_NAME=gig_i_prod DB_USER=gig_i_user DB_PASSWORD=GiGi@Secure2026! \
  python db_migrate.py
"""
import os, sys, logging

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

def run():
    from database import engine, ping_db
    from models import Base

    logger.info(f"[Migrate] Testing DB connection...")
    if not ping_db():
        logger.error("[Migrate] Cannot reach database. Check connection settings.")
        sys.exit(1)
    logger.info("[Migrate] DB reachable. Creating tables...")

    Base.metadata.create_all(bind=engine)

    from sqlalchemy import inspect
    tables = inspect(engine).get_table_names()
    logger.info(f"[Migrate] Done! Tables: {sorted(tables)}")

    required = {"users", "policies", "claims", "worker_shifts",
                "telemetry_pings", "agent_logs", "audit_logs"}
    missing = required - set(tables)
    if missing:
        logger.error(f"[Migrate] Missing tables: {missing}")
        sys.exit(1)
    logger.info("[Migrate] All 7 required tables present. Migration complete!")

if __name__ == "__main__":
    run()
