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

Open http://127.0.0.1:8000/docs. Without DATABASE_URL the app runs in contract
preview mode. With DATABASE_URL it initializes the database at startup.
No RunPod endpoint is needed for startup or the contract preview.
Business endpoints intentionally return **501 Not Implemented**, including
reads: they do not pretend to save data or run checks. `/api/health` works.
Demo role gates and request validation are implemented; tenant ownership
checks, transactions, logging, image checks/storage, and rules come later.

See [the contract decisions and integration guide](docs/api-contract.md).
Merge this contract branch before the team starts parallel implementations.
After merge, keep route signatures and response models when replacing the
501 handlers. Contract changes need a coordinated schema/route/test update.

## Database setup

The five SQLAlchemy models and connection/session helpers are in
`src/backend/db.py`. For local PostgreSQL, start Docker Desktop and run:

```bash
docker compose up -d --wait postgres
uv run --env-file .env uvicorn backend.main:app --app-dir src --reload
```

Use `.env.example` to create your ignored `.env` first. Startup creates missing
tables, adds the binary-photo columns to the previous schema, and seeds empty
tables if `src/seed/seed.json` exists. Photos can be stored as PostgreSQL BYTEA;
upload/retrieval endpoints will be implemented with the business workflows.
See [the database guide](docs/database.md) and [seed format](docs/seed-format.md).
The same models use Replit's DATABASE_URL later. Importing the models alone
does not connect to a database, and business routes remain contract scaffolds.

## Label extraction model

`src/backend/extract.py` sends each label photo to a RunPod Serverless
endpoint running Qwen3-VL-8B-Instruct on vLLM. Set `RUNPOD_ENDPOINT_URL`
and `RUNPOD_API_KEY` in `.env`, then run the live test against the
endpoint:

```bash
uv run --env-file .env pytest -m live --run-live
```

Endpoint settings, setup and the warm-up before a demo are in
[the RunPod endpoint guide](runpod/README.md).

## Deploy to Replit

The app runs as a Replit Autoscale deployment. `.replit` holds the build
command (`uv sync --frozen --no-dev`) and the run command. The deployment
needs these Secrets:

| Secret | Value |
| --- | --- |
| `DATABASE_URL` | Connection URL of the Replit PostgreSQL database |
| `RUNPOD_ENDPOINT_URL` | Base URL of the endpoint's OpenAI-compatible API |
| `RUNPOD_API_KEY` | RunPod API key |

Replit doesn't deploy on a push to GitHub. To release a change merged
into `main`:

1. In the Replit workspace, open the Git pane and pull `main`.
2. Open Publishing and select Republish.
