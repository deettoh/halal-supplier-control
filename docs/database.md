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

Certificates and deliveries have `image_bytes` (PostgreSQL BYTEA) and
`image_content_type`, alongside the existing `image` reference. Photo bytes
live in the database; `image` can be a future API URL rather than a local file.
Binary columns are loaded only when explicitly accessed, keeping list reads
small. JSON columns store scope, extracted fields and the checklist. Existing
reference-only records remain valid; their new image columns start as null.
Upload validation and image-serving endpoints remain later backend work.

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

Start the backend; with DATABASE_URL configured it initializes automatically:

```powershell
uv run --env-file .env uvicorn backend.main:app --app-dir src --reload
```

Alternatively, create/upgrade the five tables without starting the server:

```powershell
uv run --env-file .env python src/backend/db.py
```

Expected output: `Connected to PostgreSQL. All five tables are ready.`
Both paths are repeatable and preserve existing records. The initializer adds
missing `image_bytes` and `image_content_type` columns to the earlier schema.
This is a narrow additive upgrade, not a general migration system: changing
other existing columns/constraints requires a separate reviewed migration.
The standalone db.py command initializes tables only; application startup
also performs optional seeding.

## Automatic startup and seeding

With DATABASE_URL configured, FastAPI waits for database bootstrap to finish
before serving requests. Startup runs the blocking database work in a thread
pool, initializes the schema, then loads `src/seed/seed.json` if present.
Only empty tables receive supplied rows; existing records are never replaced.
PostgreSQL startup workers are serialized by a transaction-scoped advisory
lock. A seed constraint/file error rolls back all inserts from that attempt
and stops startup with a sanitized error. No database credentials or raw seed
contents are logged. Connections are disposed on application shutdown.

The merged seed file contains 2 fictional suppliers, 4 certificates and 16
materials. Its product-name scope lists are normalized to structured API
scope entries. Certificate image paths are references; the image assets are
not supplied by this merge, so those rows initially have no image bytes.
Missing seed.json is allowed and skips seeding; malformed/incompatible
existing JSON fails startup. See [the seed format](seed-format.md).
The loader can copy fictional seed images into the binary columns, but it
does not decode/resize images. It is not a dataset reset tool.

Without DATABASE_URL, startup logs a warning and skips the database so `/docs`
can still be used as a contract preview. If DATABASE_URL is configured but
unreachable, startup fails rather than pretending persistence is available.

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
database. Starting the application with DATABASE_URL does initialize tables.

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

With Replit's DATABASE_URL injected, initialization/seeding runs automatically
before the app serves requests. The application keeps the existing command:

```bash
uvicorn backend.main:app --app-dir src --host 0.0.0.0 --port 8000
```

Docker Compose is local tooling; do not start it on Replit. Git transfers
models/code, not the contents of your local database or its volume. A Replit
database is initialized on startup and later receives the agreed synthetic
seed from `src/seed/seed.json`. Restarting/redeploying keeps database photos;
uploaded images must never depend on runtime filesystem files.
