"""SME rule policies and the offline seed lookup."""

import json
from pathlib import Path

from pydantic import Field

from backend.schemas import APIModel, NonEmptyText


class RuleSettings(APIModel):
    recognised_issuers: list[NonEmptyText] = Field(min_length=1)
    match_threshold: float = Field(ge=0, le=100, allow_inf_nan=False)
    expiry_warning_days: int = Field(ge=0, strict=True)


def seed_rule_settings(tenant: str) -> RuleSettings:
    """Read one SME's rule policy from the seed file.

    Args:
        tenant: SME name in the seed file.

    Returns:
        Validated policy of that SME.

    Raises:
        ValueError: If the seed lacks exactly one row for tenant.
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
