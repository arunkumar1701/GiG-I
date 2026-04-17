"""
database.py
-----------
Supports two connection modes:
  - Development:  SQLite (DB_URL starts with sqlite:///)
  - Production:   Cloud SQL PostgreSQL via Unix socket using
                  cloud-sql-python-connector (IAM auth, no password needed
                  when running on Cloud Run with the right SA).

Environment variables:
  DB_URL            - Full SQLAlchemy URL. For Cloud SQL use:
                        postgresql+pg8000://USER:PASS@/DBNAME?host=/cloudsql/PROJECT:REGION:INSTANCE
                      OR leave empty and set CLOUD_SQL_CONNECTION_NAME + DB_NAME + DB_USER + DB_PASSWORD.
  CLOUD_SQL_CONNECTION_NAME  - e.g. gig-i-a4fea:asia-south1:gig-i-db
  DB_NAME           - e.g. gig_i_prod
  DB_USER           - e.g. gig_i_user
  DB_PASSWORD       - password set in Cloud SQL
  DB_IAM_AUTH       - set to "true" to use IAM auth (passwordless, Cloud Run only)
"""
from __future__ import annotations

import os
import logging

from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from settings import settings

logger = logging.getLogger(__name__)

SQLALCHEMY_DATABASE_URL: str = settings.database_url


def _build_cloud_sql_engine():
    """
    Build a SQLAlchemy engine that connects to Cloud SQL PostgreSQL
    via the Cloud SQL Python Connector (Unix socket).
    Used when CLOUD_SQL_CONNECTION_NAME is set but DB_URL is not.
    """
    from google.cloud.sql.connector import Connector, IPTypes

    instance_connection_name = os.environ["CLOUD_SQL_CONNECTION_NAME"]
    db_user     = os.environ.get("DB_USER", "gig_i_user")
    db_password = os.environ.get("DB_PASSWORD", "")
    db_name     = os.environ.get("DB_NAME", "gig_i_prod")
    use_iam     = os.environ.get("DB_IAM_AUTH", "false").lower() == "true"

    connector = Connector()

    def getconn():
        conn = connector.connect(
            instance_connection_name,
            "pg8000",
            user=db_user,
            password=db_password if not use_iam else None,
            db=db_name,
            enable_iam_auth=use_iam,
            ip_type=IPTypes.PRIVATE if os.environ.get("DB_PRIVATE_IP", "false") == "true" else IPTypes.PUBLIC,
        )
        return conn

    engine = create_engine(
        "postgresql+pg8000://",
        creator=getconn,
        pool_size=5,
        max_overflow=2,
        pool_timeout=30,
        pool_recycle=1800,
    )
    logger.info(f"[DB] Connected via Cloud SQL Connector → {instance_connection_name}/{db_name}")
    return engine


def _build_engine():
    url = SQLALCHEMY_DATABASE_URL

    # Cloud SQL connector path (no DB_URL set but CLOUD_SQL_CONNECTION_NAME set)
    if (not url or url.startswith("postgresql+pg8000://")) and os.environ.get("CLOUD_SQL_CONNECTION_NAME"):
        return _build_cloud_sql_engine()

    # SQLite (local dev)
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}
        logger.info(f"[DB] Using SQLite → {url}")
        return create_engine(url, connect_args=connect_args)

    # Standard PostgreSQL URL (e.g. postgres:// from Cloud SQL public IP or Cloud Run proxy)
    logger.info(f"[DB] Using PostgreSQL URL → {url[:40]}...")
    return create_engine(
        url,
        pool_size=5,
        max_overflow=2,
        pool_timeout=30,
        pool_recycle=1800,
    )


engine = _build_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ping_db() -> bool:
    """Health check: returns True if DB is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"[DB] Health check failed: {e}")
        return False
