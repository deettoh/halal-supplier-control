# RunPod endpoint

`src/backend/extract.py` sends label photos through vLLM's
OpenAI-compatible API to a RunPod Serverless endpoint that runs the vLLM
worker with Qwen3-VL-8B-Instruct.

## Endpoint settings

The endpoint runs RunPod's stock vLLM worker image, so the repo has no
`handler.py`. Settings for the endpoint are in
[`endpoint.json`](endpoint.json):

- `env` lists the two worker variables set on the Hub form. Every other
  variable keeps the worker's default. `loaded_dtype` is the dtype the
  worker loads under its default `DTYPE` of `auto`.
- `worker` versions come from the worker logs.
- `served_model_name` and `MAX_MODEL_LEN` match `GET /models`.
- The endpoint name and type, the GPU and the `scaling` values come from
  the RunPod console.

## Create the endpoint

1. In the RunPod console, open the Hub, then Serverless repos, and pick
   vLLM by runpod-workers.
2. Untick the 80 GB GPUs the form pre-selects and keep the `gpu` tier from
   `endpoint.json`.
3. Set the model and Max Model Length to the `env` values in
   `endpoint.json`, then deploy.
4. Edit the endpoint and set the `scaling` values from `endpoint.json`.
5. Copy `.env.example` to `.env` at the repo root and fill in
   `RUNPOD_API_KEY` and `RUNPOD_ENDPOINT_URL`. The URL has the form
   `https://api.runpod.ai/v2/<ENDPOINT_ID>/openai/v1`.
6. Check that the `id` from `/models` matches `MODEL_ID` in
   `src/backend/extract.py` case-sensitively:

   ```bash
   set -a; . ./.env; set +a
   curl -sS -H "Authorization: Bearer $RUNPOD_API_KEY" "$RUNPOD_ENDPOINT_URL/models"
   ```

## Run the smoke test

To see whether a worker is up, query the endpoint's health route:

```bash
set -a; . ./.env; set +a
curl -sS -H "Authorization: Bearer $RUNPOD_API_KEY" "${RUNPOD_ENDPOINT_URL%/openai/v1}/health"
```

A nonzero `idle`, `ready` or `running` count under `workers` means a
worker is up. With all three at 0, the first request waits for a worker
to start, which took 2.5 minutes or more in testing.

To send the synthetic test label and check the extracted fields, run the
live test from the repo root:

```bash
uv run --env-file .env pytest -m live --run-live
```

It takes under 5s when a worker is up.

## Warm the endpoint before a dry run or the demo

With 0 active workers, the first request after the idle timeout waits
for a cold start. Before each dry run and before judging:

1. Edit the endpoint in the RunPod console, set Active workers to 1 and
   save.
2. Run the health check above until `idle` or `ready` is nonzero.
3. Run the live test above and confirm it passes.

RunPod bills an active worker for every second it is up, idle or not.
After the session, set Active workers back to 0.
