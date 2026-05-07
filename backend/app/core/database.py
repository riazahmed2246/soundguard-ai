from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from .config import settings
import os
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Directory bootstrap
# ---------------------------------------------------------------------------

def _create_upload_dirs():
    """Ensure upload directories exist before the engine is created."""
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(f"{settings.UPLOAD_DIR}/enhanced", exist_ok=True)
    os.makedirs(f"{settings.UPLOAD_DIR}/spectrograms", exist_ok=True)
    logger.info(f"Upload directories ready at: {settings.UPLOAD_DIR}")


_create_upload_dirs()

# ---------------------------------------------------------------------------
# SQLAlchemy engine
# ---------------------------------------------------------------------------

# SQLite requires check_same_thread=False so that multiple FastAPI worker
# threads can share the same connection.  For production PostgreSQL simply
# remove connect_args and the poolclass override.
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},   # SQLite-only option
    # Use StaticPool for SQLite in-process connections (avoids "database is
    # locked" errors in testing scenarios with a single connection).
    poolclass=StaticPool if settings.DATABASE_URL.startswith("sqlite") else None,
    echo=False,          # Set to True for SQL query logging during development
)


# Enable WAL mode for SQLite to allow concurrent reads and a single write
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    """Apply per-connection SQLite PRAGMAs for better concurrency & safety."""
    if settings.DATABASE_URL.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL;")   # Write-Ahead Logging
        cursor.execute("PRAGMA foreign_keys=ON;")    # Enforce FK constraints
        cursor.execute("PRAGMA synchronous=NORMAL;") # Balanced durability
        cursor.close()


# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ---------------------------------------------------------------------------
# Declarative base – imported by all ORM models
# ---------------------------------------------------------------------------

Base = declarative_base()

# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

def get_db():
    """
    Yield a SQLAlchemy session and guarantee it is closed after the request,
    even if an exception is raised.

    Usage in route::

        @router.get("/items")
        def read_items(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------------------------------------------------------------------
# Database initialisation
# ---------------------------------------------------------------------------

def init_db():
    """
    Create all tables defined in ORM models that don't already exist.

    Import all model modules *before* calling this function so that their
    ``__tablename__`` metadata is registered with ``Base``.

    Example::

        from app.models import audio   # registers Audio model
        init_db()
    """
    # Import models here to ensure they are registered with Base before
    # create_all() is called. Adjust the import path if models live elsewhere.
    try:
        from app.models import audio  # noqa: F401 – side-effect import
    except ImportError:
        logger.warning(
            "Could not import app.models.audio – tables may not be created."
        )

    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created / verified successfully.")


def drop_db():
    """
    Drop all tables – useful for testing teardowns.
    **Never call this in production.**
    """
    Base.metadata.drop_all(bind=engine)
    logger.warning("All database tables dropped.")
