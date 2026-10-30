"""Validated SME rule policies; seed lookup is for offline evaluation only."""

import json
from pathlib import Path

from pydantic import Field

from backend.schemas import APIModel, NonEmptyText


class RuleSettings(APIModel):
    recognised_issuers: list[NonEmptyText] = Field(min_length=1)
    match_threshold: float = Field(ge=0, le=100, allow_inf_nan=False)
    expiry_warning_days: int = Field(ge=0, strict=True)


def seed_rule_settings(tenant: str) -> RuleSettings:
    """Read one SME's seed policy for callers without a database session.

    Live requests pass their persisted database policy to evaluate instead.
    Missing or unknown tenants never inherit another SME's policy.
    """
    path = Path(__file__).resolve().parents[1] / "seed" / "seed.json"
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    rows = [
        row for row in data.get("sme_settings", []) if row["tenant"] == tenant
    ]
    if len(rows) != 1:
        raise ValueError(
            "Exactly one rule settings record is required for the SME"
        )
    return RuleSettings.model_validate(
        {name: rows[0][name] for name in RuleSettings.model_fields}
    )
