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
