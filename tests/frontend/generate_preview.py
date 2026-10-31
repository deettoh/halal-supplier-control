"""Build UI snapshots with backend.rules."""

import copy
import hashlib
import json
from pathlib import Path
from typing import Any

from backend.rules import evaluate
from backend.schemas import (
    ActivityResponse,
    CertificateResponse,
    DeliveryResponse,
    MaterialResponse,
)

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "src/frontend/src/lib/preview/data.json"
DATE = "2026-10-22"


def generate() -> dict[str, Any]:
    seed_path = ROOT / "src/seed/seed.json"
    seed = json.loads(seed_path.read_text())
    suppliers = {s["id"]: s["name"] for s in seed["suppliers"]}
    materials = {str(m["id"]): m for m in seed["materials"]}
    active = {
        str(c["supplier_id"]): c
        for c in seed["certificates"]
        if c["status"] == "active"
    }
    certificates = {}
    renewals = {}
    for supplier_id in ["1", "2"]:
        certificates[supplier_id] = [
            CertificateResponse.model_validate(
                {
                    **{k: v for k, v in c.items() if k != "image_file"},
                    "image": None,
                }
            ).model_dump(mode="json")
            for c in seed["certificates"]
            if str(c["supplier_id"]) == supplier_id
        ]
        current = active[supplier_id]
        renewals[supplier_id] = {
            k: copy.deepcopy(current[k])
            for k in [
                "issuer",
                "cert_no",
                "holder_name",
                "expiry_date",
                "scope",
            ]
        }
        renewals[supplier_id]["cert_no"] = (
            "SAMPLE-GGS-2027-PREVIEW"
            if supplier_id == "1"
            else "SAMPLE-SVI-2028-PREVIEW"
        )
        renewals[supplier_id]["expiry_date"] = (
            "2027-11-30" if supplier_id == "1" else "2028-09-30"
        )
    snapshots = {}
    for bits in ["00", "10", "01", "11"]:
        snapshot: dict[str, list[dict[str, Any]]] = {}
        for m in seed["materials"]:
            sid = str(m["supplier_id"])
            cert = renewals[sid] if bits[int(sid) - 1] == "1" else active[sid]
            result = evaluate(
                {
                    "product_name": m["name"],
                    "brand": m["approved_brand"],
                    "manufacturer": m["approved_manufacturer"],
                    # coverage ignores the halal mark
                    "halal_mark_present": True,
                },
                m,
                cert,
                DATE,
            )
            row = MaterialResponse.model_validate(
                {
                    **{k: v for k, v in m.items() if k != "tenant"},
                    "supplier_name": suppliers[m["supplier_id"]],
                    "coverage_status": result["verdict"],
                    "certificate_expiry_date": cert["expiry_date"],
                }
            ).model_dump(mode="json")
            snapshot.setdefault(m["tenant"], []).append(row)
        snapshots[bits] = snapshot
    cases: list[dict[str, Any]] = []
    for case_id, filename, brand, product, manufacturer, has_mark, title in [
        (
            "alt-brand",
            "label-alt-brand.jpg",
            "ALT SAMPLE BRAND",
            "Cocoa Powder",
            "Silver Valley Foods",
            False,
            "Changed brand",
        ),
        (
            "covered",
            "label-covered.jpg",
            "SilverCocoa",
            "Cocoa Powder",
            "Silver Valley Foods",
            True,
            "Matching cocoa label",
        ),
        (
            "partial",
            "label-partial.jpg",
            "SilverCocoa",
            "Cocoa Powder",
            None,
            False,
            "Manufacturer unreadable",
        ),
        (
            "expiring",
            "label-expiring.jpg",
            "GoldenMill",
            "Wheat Flour",
            "Golden Grain Foods",
            True,
            "Expiring flour record",
        ),
        (
            "alt-brand-flour",
            "label-alt-brand-flour.jpg",
            "HarvestStone",
            "Wheat Flour",
            "Golden Grain Foods",
            True,
            "Changed flour brand",
        ),
        (
            "alt-manufacturer",
            "label-alt-manufacturer.jpg",
            "GoldenMill",
            "Wheat Flour",
            "Meadow Forge Foods",
            True,
            "Changed flour manufacturer",
        ),
        (
            "absent-mark",
            "label-absent-mark.jpg",
            "GoldenMill",
            "Wheat Flour",
            "Golden Grain Foods",
            None,
            "Flour without a halal mark",
        ),
    ]:
        image = "/media/" + filename
        content = (
            ROOT / "src/frontend/public" / image.lstrip("/")
        ).read_bytes()
        extracted = {
            "product_name": product,
            "brand": brand,
            "manufacturer": manufacturer,
            "halal_mark_present": has_mark,
        }
        responses_by_renewal = {}
        for bits in ["00", "10", "01", "11"]:
            responses = {}
            for mid, m in materials.items():
                if m["name"] != product:
                    continue
                sid = str(m["supplier_id"])
                cert = (
                    renewals[sid] if bits[int(sid) - 1] == "1" else active[sid]
                )
                result = evaluate(extracted, m, cert, DATE)
                responses[mid] = DeliveryResponse.model_validate(
                    {
                        "id": 500,
                        "material_id": int(mid),
                        "image": image,
                        "extracted": extracted,
                        **result,
                        "status": "auto_accepted"
                        if result["verdict"] in ["covered", "expiring"]
                        else "pending_review",
                        "error": None,
                        "decided_by": None,
                        "reason": None,
                        "created_at": "2026-10-22T10:31:00+08:00",
                    }
                ).model_dump(mode="json")
            responses_by_renewal[bits] = responses
        cases.append(
            {
                "id": case_id,
                "title": title,
                "image": image,
                "sha256": hashlib.sha256(content).hexdigest(),
                "extracted": extracted,
                "responses": responses_by_renewal["00"],
                "responses_by_renewal": responses_by_renewal,
            }
        )
    tenant = "Sunrise Bakery SAMPLE"
    by_id = {c["id"]: c for c in cases}
    alt = copy.deepcopy(by_id["alt-brand-flour"]["responses"]["1"])
    alt["id"] = 102
    absent = copy.deepcopy(by_id["absent-mark"]["responses"]["1"])
    absent.update(id=104, created_at="2026-10-22T10:34:00+08:00")
    initial_activity: dict[str, list[dict[str, Any]]] = {
        tenant: [],
        "Crescent Caterer SAMPLE": [],
    }
    for d in [alt, absent]:
        initial_activity[tenant].append(
            ActivityResponse(
                id=d["id"],
                actor=next(
                    p["name"]
                    for p in seed["people"]
                    if p["role"] == "staff" and p["tenant"] == tenant
                ),
                role="staff",
                action=d["status"],
                delivery_id=d["id"],
                reason=None,
                created_at=d["created_at"],
            ).model_dump(mode="json")
            | {
                "actor_title": next(
                    p["title"]
                    for p in seed["people"]
                    if p["role"] == "staff" and p["tenant"] == tenant
                ),
                "material_name": materials[str(d["material_id"])]["name"],
                "verdict": d["verdict"],
                "supplier_name": None,
            }
        )
    return {
        "people": copy.deepcopy(seed["people"]),
        "suppliers": copy.deepcopy(seed["suppliers"]),
        "provenance": (
            "Prepared synthetic UI simulation; not inference, "
            "persistence or evaluation measurements."
        ),
        "date": DATE,
        "seed_sha256": hashlib.sha256(seed_path.read_bytes()).hexdigest(),
        "materials": snapshots,
        "certificates": certificates,
        "renewals": renewals,
        "cases": cases,
        "source_materials": materials,
        "source_certificates": active,
        "deliveries": {tenant: [alt, absent], "Crescent Caterer SAMPLE": []},
        "initial_activity": initial_activity,
    }


if __name__ == "__main__":
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        json.dumps(generate(), indent=2) + "\n", encoding="utf-8"
    )
    print(
        "Prepared preview fixtures generated from canonical schemas and rules."
    )
