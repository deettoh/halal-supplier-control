"""Atomic schema initialization and optional seed loading at startup."""

from pathlib import Path

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from backend import db
from backend.seed import (
    DEFAULT_SEED_PATH,
    load_seed,
    seed_empty_tables,
    upgrade_stored_photos,
)


def bootstrap_database(
    engine: Engine | None = None, seed_path: Path = DEFAULT_SEED_PATH
) -> dict[str, int]:
    seed = load_seed(seed_path)
    target = db.get_engine() if engine is None else engine
    with Session(target) as session, session.begin():
        db.init_db(session.connection())
        counts = (
            seed_empty_tables(session, seed, seed_path.parent)
            if seed is not None
            else {}
        )
        upgrade_stored_photos(session)
        return counts
