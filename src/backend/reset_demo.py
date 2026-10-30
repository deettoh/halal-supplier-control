"""Explicitly replace demo records from seed JSON; never called at startup.

Stop the application before running from the repository root:
    uv run --directory src --env-file ../.env python -m backend.reset_demo \
        --confirm-reset-demo
"""

import argparse
import sys
from pathlib import Path

from pydantic import ValidationError
from sqlalchemy import Engine, delete, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from backend import db
from backend.seed import DEFAULT_SEED_PATH, load_seed, seed_empty_tables


def reset_demo_database(
    engine: Engine | None = None, seed_path: Path = DEFAULT_SEED_PATH
) -> dict[str, int]:
    """Replace application data atomically, retaining schema and ID sequences.

    Call only while the application is stopped. Caller must explicitly intend
    to discard existing uploads, renewals, decisions and audit history.
    """
    seed = load_seed(seed_path)
    if seed is None:
        raise ValueError(f"Seed JSON file is missing: {seed_path}")
    if not seed.suppliers or not seed.certificates or not seed.materials:
        raise ValueError(
            "Demo reset requires suppliers, certificates and materials"
        )
    target = db.get_engine() if engine is None else engine
    with Session(target) as session, session.begin():
        connection = session.connection()
        db.init_db(connection)
        if connection.dialect.name == "postgresql":
            tables = ", ".join(
                db.qualified_table_name(connection, name)
                for name in db.Base.metadata.tables
            )
            connection.execute(text(f"LOCK TABLE {tables} IN EXCLUSIVE MODE"))
        for model in (
            db.SMESettings,
            db.ActivityLog,
            db.Delivery,
            db.Material,
            db.Certificate,
            db.Supplier,
            db.Person,
        ):
            session.execute(delete(model))
        return seed_empty_tables(
            session, seed, seed_path.parent, require_images=True
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Replace ALL demo data in DATABASE_URL with seed JSON, including "
            "photos. Removes uploads, renewals, decisions and activity logs. "
            "Stop the application first."
        )
    )
    parser.add_argument("--seed", type=Path, default=DEFAULT_SEED_PATH)
    parser.add_argument(
        "--confirm-reset-demo",
        action="store_true",
        help="explicitly allow replacement of every SME's demo data",
    )
    args = parser.parse_args(argv)
    if not args.confirm_reset_demo:
        parser.error("No data changed; pass --confirm-reset-demo to reset")
    try:
        counts = reset_demo_database(seed_path=args.seed)
    except (OSError, ValueError, SQLAlchemyError) as error:
        if isinstance(error, SQLAlchemyError):
            detail = type(error).__name__
        elif isinstance(error, ValidationError):
            detail = f"Invalid seed JSON in {args.seed}; check its fields"
        else:
            detail = str(error)
        print(
            f"Demo reset failed: {detail}; "
            "no record replacement was committed. "
            "Check seed files and database.",
            file=sys.stderr,
        )
        return 1
    finally:
        db.dispose_db()
    print(
        "Demo reset complete: "
        + ", ".join(f"{name}={count}" for name, count in counts.items())
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
