# halal-supplier-control

## Development setup

The project uses [uv](https://docs.astral.sh/uv/getting-started/installation/) for Python dependencies.
Install uv, then run these from the repo root:

```bash
uv sync           # create .venv and install runtime and dev dependencies
uv run pytest -q  # run the test suite
```

To add a dependency, run `uv add` and regenerate `requirements.txt` for
the submission template:

```bash
uv add <package>
uv export --no-dev --no-hashes --no-emit-project -o requirements.txt
```

## Shared API contract

`src/backend/schemas.py` is the shared request/response vocabulary.
`src/backend/main.py` binds it to the eight business endpoints so FastAPI's
generated **`/docs` and `/openapi.json` are the API contract**. Run locally:

```bash
uv run uvicorn backend.main:app --app-dir src --reload
```

Open http://127.0.0.1:8000/docs. No database URL or RunPod endpoint is needed.
Business endpoints intentionally return **501 Not Implemented**, including
reads: they do not pretend to save data or run checks. `/api/health` works.
Demo role gates and request validation are implemented; tenant ownership
checks, transactions, logging, image checks/storage, and rules come later.

See [the contract decisions and integration guide](docs/api-contract.md).
Merge this contract branch before the team starts parallel implementations.
After merge, keep route signatures and response models when replacing the
501 handlers. Contract changes need a coordinated schema/route/test update.

## Database setup

The five SQLAlchemy models and lazy connection/session helpers are in
`src/backend/db.py`. For local PostgreSQL, start Docker Desktop and run
`docker compose up -d --wait postgres`, then follow the environment,
initialisation and test commands in [the database guide](docs/database.md).
The same models use Replit's DATABASE_URL later. Importing the models does
not connect to a database, and business routes remain contract scaffolds.
