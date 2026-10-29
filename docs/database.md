# Database

The app stores its records and photos in PostgreSQL through SQLAlchemy. The
models and the session helpers are in `src/backend/db.py`, and the API models
in `src/backend/schemas.py` are defined separately.

## Six tables hold the data

| Table | Contents | Scope |
|---|---|---|
| `people` | Fictional name, title, role and tenant | Demo identities |
| `suppliers` | Supplier IDs and names | Shared by every SME |
| `certificates` | Issuer, number, holder, expiry, scope, photo and version status | Shared, one active row per supplier |
| `materials` | Approved product, supplier, brand and manufacturer | One SME (`tenant`) |
| `deliveries` | Label photo, extracted fields, rule results, verdict, status and decision | One SME |
| `activity_log` | Actor, role, action, reason and time | One SME |

The `certificates` table is the shared supplier registry. Materials point to
a supplier, and coverage is computed from that supplier's active certificate
on every read.

Constraints in the database enforce the allowed statuses and actions, at most
one active and one pending certificate per supplier, matching tenants on
linked rows, and both a decision actor and a nonblank reason on decided
deliveries. Queries still filter by SME and check supplier ownership in
`services.py`.

Photos are stored as JPEG in the `image_bytes` column (PostgreSQL `BYTEA`) and
load only when read. The `image` column holds the photo's API URL.

## Run PostgreSQL locally

`compose.yaml` starts PostgreSQL 17 on `127.0.0.1:55432` with a named volume.
Its username and password are local development values.

```bash
uv sync --locked
cp -n .env.example .env              # keep an existing .env
docker compose up -d --wait postgres
uv run --env-file .env uvicorn backend.main:app --app-dir src --reload
```

`.env.example` has the local `DATABASE_URL` and `TEST_DATABASE_URL`. Python
doesn't load `.env` by itself, so local commands pass `--env-file .env`.

To create the tables without starting the server, run
`uv run --env-file .env python src/backend/db.py`. It prints
`Connected to PostgreSQL. Application tables are ready.`

To inspect or stop the database, run:

```bash
docker compose exec postgres psql -U halal -d halal_supplier_control -c '\dt'
docker compose stop postgres   # keeps the data volume
```

## Startup creates the tables and loads the seed

With `DATABASE_URL` set, the app does this before serving requests:

1. Creates any missing tables, such as `people`, and adds any missing columns
   to older tables, such as `image_bytes` and the review columns on
   `certificates`. Older certificates get the upgrade time as `created_at`,
   the field the reviewer queue is sorted by. It also widens the status,
   action and role checks for renewal review and adds the index that allows at
   most one pending certificate per supplier. It doesn't drop existing columns
   or data.
2. Loads `src/seed/seed.json` into tables that are still empty. The format is
   in [the seed README](../src/seed/README.md).
3. Fills missing certificate photos from the seed PNGs and converts any
   stored PNG photos to JPEG.

Startup holds a PostgreSQL advisory lock, so parallel workers don't seed
twice. On any error, startup rolls the whole attempt back and stops with a
message that has no credentials or seed contents.

Without `DATABASE_URL`, startup skips the database and only `/api/health`,
`/docs` and the static frontend respond. With a URL that can't be reached,
startup fails.

## Reset the demo data

The reset replaces the data in all six tables with `src/seed/seed.json`,
for both SMEs and every supplier. Uploads, decisions, renewals and the
activity log are removed. Stop the app first, then run from the repo root:

```bash
uv run --directory src --env-file ../.env python -m backend.reset_demo --confirm-reset-demo
```

Without `--confirm-reset-demo` the command exits before touching the
database. `--seed PATH` picks another seed file. Every `image_file` in the
seed must be a readable PNG, and a failed reset rolls back and keeps the
existing data. The command targets whatever `DATABASE_URL` it receives. On
Replit, see [the deployment guide](deployment.md#reset-the-production-database).

The reset restores the seed's dates and doesn't shift them, so expiry
statuses depend on the day it runs.

## Use a session in a route

```python
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from backend.db import get_db

DatabaseSession = Annotated[Session, Depends(get_db)]
```

Each request gets its own session. Write routes call `session.commit()`, and
the dependency rolls back anything uncommitted when the session closes.

## Tests run on SQLite, and also on PostgreSQL with `--run-db`

```bash
uv run pytest -q                                  # in-memory SQLite
uv run --env-file .env pytest -q --run-db         # also on PostgreSQL
```

`--run-db` needs `TEST_DATABASE_URL`, which is separate from
`DATABASE_URL`. Each PostgreSQL test creates a schema named `halal_test_` or
`halal_api_test_` plus a random suffix and drops only that schema afterwards.
Point `TEST_DATABASE_URL` at the local database.
