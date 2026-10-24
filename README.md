# Halal Supplier Control

Halal Supplier Control checks every ingredient delivered to a halal-certified
micro food business against the business's Raw Material Masterlist and the
supplier's halal certificate. Anything that doesn't match is queued for the
Halal Supervisor's recorded decision. It is built for SDC Hackathon 2026,
Domain 2 (Orbyte Smart SME Challenge), on the SDG 8 track.

## Submission links

| Item | Link |
|---|---|
| Live prototype | https://halal-supplier-control--dedoh.replit.app |
| Code repository | https://github.com/deettoh/halal-supplier-control |
| Pitch video (YouTube) | Link to be added |
| Pitch slides | Link to be added |
| Proposal | `submission/SDC2026_TanAhChing_Preliminary.pdf` (to be added) |
| Technical & Tools Declaration | `submission/SDC2026_TanAhChing_TechDeclaration.pdf` (to be added) |
| Replit proof of use | [submission/SDC2026_TanAhChing_Replit_POU.pdf](submission/SDC2026_TanAhChing_Replit_POU.pdf) |
| RunPod proof of use | [submission/SDC2026_TanAhChing_Runpod_POU.pdf](submission/SDC2026_TanAhChing_Runpod_POU.pdf) |

## It checks each delivery at the receiving door

At receiving, staff photograph the delivered item's label. A vision model
reads the product name, brand, manufacturer and halal mark, and five rules
check them against the masterlist and the supplier's certificate. A clean
delivery is logged automatically. Anything else waits for the Halal
Supervisor, who accepts or rejects it with a reason.

| Step | In Halal Supplier Control |
|---|---|
| Trigger | A delivery arrives and staff photograph its label |
| Data | The SME's masterlist and the shared supplier certificate registry |
| Decision | The model reads the label, and rules R1 to R5 give the verdict |
| Approval | Only the Halal Supervisor can accept or reject a flagged delivery with a required reason |
| Outcome | Verdict with a rule checklist, delivery status, masterlist coverage and an activity log row |

Certificates are stored in one registry shared by every SME. When a supplier
renews a certificate once, every SME that buys from that supplier sees its own
items change from Expiring to Covered. The app reports whether the documents
on file cover an item. It doesn't rule on whether anything is halal.

## Try the demo

Open the live prototype, select Enter demo, and pick a role and an
organisation. The demo script follows the project brief:

1. As the Halal Supervisor of Sunrise Bakery SAMPLE, open Masterlist. Wheat
   Flour shows Expiring.
2. As Receiving staff, check a Cocoa Powder delivery with a clean label. The
   verdict is Covered and the delivery is accepted automatically.
3. Check another Cocoa Powder delivery from a different brand. The verdict is
   Substitution, with rule R2 failed, and the delivery is queued for the
   supervisor.
4. As the supervisor, open Review deliveries and reject it with a reason.
5. Open Activity to see each step with the role, action and time.
6. Switch to Crescent Caterer SAMPLE. Its Wheat Flour from the same supplier
   also shows Expiring.
7. As the supplier Golden Grain Supplies SAMPLE, publish a renewed
   certificate. Both SMEs now show Wheat Flour as Covered.

On the live site, use a label photo from `tests/eval/images/`, for example
`L01.png` (clean) or `L02.png` (different brand). The first check after the
model has been idle can take about three minutes.

## Screenshots from the live site

| Covered delivery | Substitution flagged |
|---|---|
| ![Covered verdict with all five rules passed](docs/images/verdict-covered.jpg) | ![Substitution verdict with the brand mismatch](docs/images/verdict-substitution.jpg) |
| Supervisor review | Activity log |
| ![Supervisor comparing the approved brand with the label](docs/images/review-queue.jpg) | ![Activity log with the rejection and its reason](docs/images/activity-log.jpg) |

## One web app on Replit and one model on RunPod

FastAPI on Replit serves the React app and the API, and stores everything in
Replit PostgreSQL. Label photos are sent to Qwen3-VL-8B-Instruct on a RunPod
Serverless endpoint, which returns the fields as JSON, and Python rules
decide the verdict. More detail is in these docs:

- [Architecture](docs/architecture.md): diagram, stack and the delivery check
- [API reference](docs/api.md): routes, rules and error codes
- [Database](docs/database.md): tables, local PostgreSQL and the demo reset
- [Deployment](docs/deployment.md): Replit build, Secrets and releases
- [RunPod endpoint](runpod/README.md): model settings and warm-up
- [Frontend](src/frontend/README.md): modes, routes and checks
- [Seed data](src/seed/README.md): the fictional dataset format

## The live test read every visible field correctly

A live run on eight AI-generated label photos read 27 of 27 visible fields
correctly and gave the expected verdict in 8 of 8 cases. On hidden fields the
model left 4 of 5 blank and guessed the remaining one. Checked by hand, the
same eight cases took a median of 82 seconds each. The method, the timings,
the cases and the limits of a synthetic set are in
[the evaluation README](tests/eval/README.md).

CI runs the backend and frontend checks on every pull request and on `main`.
At this commit, `uv run pytest -q` reports 259 passed and 114 skipped, where
the skipped tests need PostgreSQL (`--run-db`) or the live endpoint
(`--run-live`). `pnpm --dir src/frontend test --run` reports 81 passed.

## Run it locally

You need Python 3.11 or later with [uv](https://docs.astral.sh/uv/), Node 24
with pnpm 11, and Docker for the local PostgreSQL.

```bash
uv sync
cp -n .env.example .env   # add RUNPOD_ENDPOINT_URL and RUNPOD_API_KEY for label reading
docker compose up -d --wait postgres
uv run --env-file .env uvicorn backend.main:app --app-dir src --reload
```

In a second terminal, start the frontend and open the URL it prints:

```bash
pnpm --dir src/frontend install --frozen-lockfile
pnpm --dir src/frontend dev
```

Without the RunPod variables, uploads are saved as Reading incomplete
(`needs_human`). The API docs are at http://127.0.0.1:8000/docs.

To run the checks:

```bash
uv run pytest -q
uv run ruff check --select E,F,I src tests
uv run mypy src/backend tests
pnpm --dir src/frontend test --run && pnpm --dir src/frontend lint
```

Python dependencies are declared in `pyproject.toml` and pinned in `uv.lock`,
so the repo has no `requirements.txt`. To produce one, run
`uv export --frozen --no-dev --no-hashes --no-emit-project -o requirements.txt`.

## AI use and sponsor resources

- Qwen3-VL-8B-Instruct, an open-weight vision model, reads the label photos.
  It runs on our own RunPod Serverless endpoint, so photos aren't sent to a
  third-party LLM vendor. Rules and the supervisor make every decision.
- Replit hosts the app, its PostgreSQL database and its Secrets. RunPod runs
  the model on sponsor credit. Both are declared in the Technical & Tools
  Declaration.
- The team used Claude Code, OpenAI Codex, OpenAI's image generation and the
  Replit AI assistant while building.

## All data is synthetic

The demo uses two fictional SMEs, two suppliers and a fictional certification
body marked SAMPLE, with no JAKIM logo and no personal data. The role and
organisation picker simulates login. In a production deployment, Malaysia's
PDPA principles would apply to staff accounts and supplier contacts through
Orbyte's login, purpose notices and a retention period for label photos.

## Project structure

To list these folders, run
`ls -d runpod src/backend src/frontend src/seed tests tests/eval submission docs`.

```text
runpod/        RunPod endpoint guide
src/backend/   FastAPI app, rules, model client and database
src/frontend/  React app
src/seed/      Fictional seed data and certificate images
tests/         Backend and frontend-contract tests
tests/eval/    Synthetic label set, scorer and live results
submission/    Submission PDFs
docs/          Architecture, API, database and deployment guides
```

## Team

Team Tan Ah Ching, Xiamen University Malaysia: Jay Hu, Nigel Cheong Tze
Hock, Tan Ching Yang, Evelyn Chan Yee Syen and Lee Yi Hong.

## License

Apache License 2.0. See [LICENSE](LICENSE).
