# Local PostgreSQL and database models

`src/backend/db.py` describes the five persistent tables. `schemas.py`
describes API input/output. Changing one does not automatically change the
other. This branch adds storage infrastructure; business API handlers still
return 501 until their workflows are implemented.

| Table | Stores | Scope |
| --- | --- | --- |
| suppliers | Supplier names and IDs | Shared |
| certificates | Issuer, number, holder, expiry, scope, image reference, version status | Shared per supplier |
| materials | Approved product, supplier, brand and manufacturer | One SME (`tenant`) |
| deliveries | Label reference, extraction JSON, checklist, verdict and decision | One SME |
| activity_log | Who did what, role, time and reason | One SME |

Certificate images and label images are references, not image bytes. JSON
columns store scope, extracted fields, and the R1-R5 checklist, including
nullable results. Timestamps are timezone-aware on PostgreSQL.

## Start locally (PowerShell in the repository root)

```powershell
uv sync --locked
docker compose up -d --wait postgres
```

Compose uses `postgres:17-alpine`, binds only `127.0.0.1:55432`, and stores
data in the named `halal-supplier-control_postgres_data` volume. It does not
reuse another project's PostgreSQL container. The committed username/password
are local development defaults only, not production credentials.

If `.env` does not exist, create it from the example:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

If it already exists, preserve its RunPod settings and add the DATABASE_URL
and TEST_DATABASE_URL entries from `.env.example`. `.env` is ignored by Git.
The plain Python module reads environment variables; it does not auto-load
`.env`. `uv run --env-file .env` loads that file explicitly for local commands.

Create the five empty tables:

```powershell
uv run --env-file .env python src/backend/db.py
```

Expected output: `Connected to PostgreSQL. All five tables are ready.`
The command is repeatable: it creates missing tables without deleting rows.
It is not a migration tool: changes to existing columns/constraints need a
separate reviewed migration later. No seed dataset is installed by this step.

Inspect the database:

```powershell
docker compose exec postgres psql -U halal -d halal_supplier_control -c '\dt'
```

Stop it while preserving records and the volume:

```powershell
docker compose stop postgres
```

## Tests

```powershell
uv run pytest -q
uv run --env-file .env pytest -q --run-db
```

Normal tests run persistence checks using in-memory SQLite with foreign keys
enabled. `--run-db` additionally runs the same checks on actual PostgreSQL.
It requires TEST_DATABASE_URL explicitly; it never defaults to DATABASE_URL.
Each PostgreSQL test creates a new random `halal_test_...` schema, then drops
only that schema after the test. Public/business tables and their data remain.
Use the local development database for this test URL, never production.
RunPod/live tests remain skipped unless separately requested with --run-live.

## Backend use

```python
from typing import Annotated
from fastapi import Depends
from sqlalchemy.orm import Session
from backend.db import get_db

DatabaseSession = Annotated[Session, Depends(get_db)]
```

Each request gets its own session. Successful writes must explicitly call
`session.commit()` (or use a transaction block); closing the dependency rolls
back uncommitted work. Importing db.py and starting `/docs` do not require a
database and do not create any tables.

Database constraints enforce valid stored statuses, at most one active
certificate per supplier, and matching tenant IDs on linked deliveries,
materials and activity. Accepted/rejected deliveries require a decision actor
and a nonblank reason. They do not replace backend permission checks: queries
must still filter on the current SME, and supplier writes must check ownership.

A renewal transaction should mark the previous certificate superseded,
`session.flush()` to release its active slot, insert the new active version,
and write one activity entry per linked SME, then commit together. This branch
does not implement that workflow or concurrent-renewal handling.
Material coverage is calculated from the active registry entry, never stored.

## Later on Replit

Push/merge the code and pull it into the Replit project. Install the updated
requirements and use Replit's injected DATABASE_URL instead of the local
Docker URL. Ordinary `postgresql://` URLs are adapted to the psycopg driver;
any SSL query options are preserved. The engine is cached per process, so
restart the app after changing the URL.

In the intended Replit environment, initialise the database explicitly:

```bash
python src/backend/db.py
```

The application still starts with the existing command:

```bash
uvicorn backend.main:app --app-dir src --host 0.0.0.0 --port 8000
```

Docker Compose is local tooling; do not start it on Replit. Git transfers
models/code, not the contents of your local database or its volume. A Replit
database needs its own initialisation and, later, the agreed synthetic seed.
