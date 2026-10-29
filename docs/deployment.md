# Deployment

The live app is a Replit Autoscale deployment at
https://halal-supplier-control--dedoh.replit.app. FastAPI serves the React
build at the site root and the API under `/api`. The model runs on a RunPod
Serverless endpoint, set up as described in [the RunPod guide](../runpod/README.md).

## Replit builds the frontend, then runs Uvicorn

`.replit` defines both steps. The build installs Node 24 from Nix, builds the
React app with pnpm, then installs the Python dependencies from `uv.lock`:

```bash
cd src/frontend && npx --yes pnpm@11.25.0 install --frozen-lockfile \
  && npx --yes pnpm@11.25.0 build && cd ../.. && uv sync --frozen --no-dev
```

The run step starts Uvicorn on port 8000, which Replit exposes on port 80:

```bash
uv run --no-sync uvicorn backend.main:app --app-dir src --host 0.0.0.0 --port 8000
```

The deployment needs these Secrets:

| Secret | Value |
|---|---|
| `DATABASE_URL` | Connection URL of the deployment's PostgreSQL database |
| `RUNPOD_ENDPOINT_URL` | Base URL of the endpoint's OpenAI-compatible API, ending in `/openai/v1` |
| `RUNPOD_API_KEY` | RunPod API key |

On its first start the app creates the tables and loads the seed (see
[the database guide](database.md#startup-creates-the-tables-and-loads-the-seed)).

## Release a change from main

Replit doesn't deploy on a push to GitHub. To release a change merged into
`main`:

1. In the Replit workspace, open the Git pane and pull `main`.
2. Open Publishing and select Republish.

A data change, such as a reset, needs neither step.

## Reset the production database

The published app has its own production database, separate from the
development database that the workspace Shell connects to by default. To
reset the demo data on the live site:

1. Open the Database tool, select the production database, open Settings and
   copy its connection string.
2. In the Shell, run the reset with that string:

   ```bash
   DATABASE_URL='<production connection string>' \
     uv run --directory src python -m backend.reset_demo --confirm-reset-demo
   ```

3. Check the live site. The review queue and activity log are empty.

After every rehearsal and before judging, reset the data so visitors start
from the seed state.

## Warm the endpoint and reset the data before a demo

1. Warm the RunPod endpoint with one active worker and run the live test, as
   described in [the RunPod guide](../runpod/README.md#warm-the-endpoint-before-a-dry-run-or-the-demo).
   A cold start can take 2.5 minutes or more.
2. Reset the production database.
3. Open the live URL in a private window and run the
   [demo script](demo.md).
4. Afterwards, set active workers back to 0, because RunPod bills an active
   worker for every second it is up.
