# RunPod endpoint

`src/backend/extract.py` sends label photos through vLLM's
OpenAI-compatible API to a RunPod Serverless endpoint that runs the vLLM
worker with Qwen3-VL-8B-Instruct.

## Endpoint settings

| Setting | Value | Source |
| --- | --- | --- |
| Endpoint name | `halal-label-extract` | RunPod console |
| Worker | vLLM from the Hub's Serverless repos (runpod-workers), worker 1.12.0 with vLLM 0.31.0 | Worker logs |
| Model | `Qwen/Qwen3-VL-8B-Instruct`, bf16 | RunPod console |
| Served model name | `qwen/qwen3-vl-8b-instruct` | `GET /models` |
| Max model length | 8192 tokens | `GET /models` |
| GPU | 24 GB tier | RunPod console |
| Active workers | 0 | RunPod console |
| Max workers | 1 | RunPod console |
| Idle timeout | 60 s | RunPod console |
| FlashBoot | On | RunPod console |

## Create the endpoint

1. In the RunPod console, open the Hub, then Serverless repos, and pick
   vLLM by runpod-workers.
2. Untick the 80 GB GPUs the form pre-selects and keep the 24 GB tier.
3. Set the model to `Qwen/Qwen3-VL-8B-Instruct` and Max Model Length to
   8192, then deploy.
4. Edit the endpoint and set the worker values from the table above.
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
