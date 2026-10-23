import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { File } from "node:buffer";
import { webcrypto } from "node:crypto";
import {
  createPreviewGateway,
  previewCases,
  preparedRenewal,
} from "./gateway.js";
const staff = { role: "staff", tenant: "Sunrise Bakery SAMPLE" };
const supervisor = { ...staff, role: "supervisor" };
let g;
beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    configurable: true,
  });
  g = createPreviewGateway();
});
const photo = (name) =>
  new File(
    [readFileSync(new URL("../../../public" + name, import.meta.url))],
    name.split("/").at(-1),
    { type: "image/png" },
  );
describe("isolated prepared-example gateway", () => {
  it("uses the renewed certificate for the next prepared delivery without rewriting earlier checks", async () => {
    const sample = photo(previewCases.find((c) => c.id === "expiring").image);
    const before = await g.createDelivery(staff, { material_id: 1, image: sample });
    expect(before.verdict).toBe("expiring");
    await g.renewCertificate({ role: "supplier", tenant: "1" }, preparedRenewal("1"));
    const after = await g.createDelivery(staff, { material_id: 1, image: sample });
    expect(after.verdict).toBe("covered");
    expect(after.rule_results.find((r) => r.rule === "R4").detail).toContain("2027-11-30");
    expect((await g.listHistory(supervisor, {})).find((r) => r.id === before.id).verdict).toBe("expiring");
  });
  it("discards a prepared upload that finishes after preview reset", async () => {
    const c = previewCases.find((c) => c.id === "alt-brand");
    const actual = photo(c.image);
    let release;
    const image = {
      arrayBuffer: () =>
        new Promise((r) => {
          release = r;
        }),
    };
    const pending = g.createDelivery(staff, { material_id: 6, image });
    await g.resetPreview();
    release(await actual.arrayBuffer());
    await expect(pending).rejects.toMatchObject({
      name: "UnsupportedCapabilityError",
    });
    expect(await g.listPending(supervisor, {})).toHaveLength(2);
  });
  it("isolates the two SMEs and rejects role-inappropriate reads", async () => {
    expect((await g.listMaterials(staff, {})).map((m) => m.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(
      (
        await g.listMaterials(
          { ...staff, tenant: "Crescent Caterer SAMPLE" },
          {},
        )
      ).map((m) => m.id),
    ).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    await expect(g.listPending(staff, {})).rejects.toMatchObject({
      status: 403,
    });
  });
  it("preserves null checks as not evaluated", async () => {
    const rows = await g.listPending(supervisor, {});
    expect(rows[1].rule_results.map((r) => r.passed)).toEqual([
      false,
      null,
      null,
      true,
      true,
    ]);
  });
  it("rejects arbitrary bytes instead of pretending to read them", async () => {
    await expect(
      g.createDelivery(staff, {
        material_id: 6,
        image: new File(["unknown"], "other.png"),
      }),
    ).rejects.toMatchObject({ name: "UnsupportedCapabilityError" });
  });
  it("attributes a prepared receipt to staff rather than the supervisor", async () => {
    const c = previewCases.find((c) => c.id === "covered");
    await g.createDelivery(staff, { material_id: 6, image: photo(c.image) });
    const rows = await g.listActivity(supervisor, {});
    expect(rows.find((r) => r.delivery_id === 500)).toMatchObject({
      actor: "Receiving staff SAMPLE",
      role: "staff",
      action: "auto_accepted",
    });
  });
  it("checks both prepared image hash and material pairing", async () => {
    const c = previewCases.find((c) => c.id === "alt-brand");
    const image = photo(c.image);
    await expect(
      g.createDelivery(staff, { material_id: 1, image }),
    ).rejects.toMatchObject({ name: "UnsupportedCapabilityError" });
    const saved = await g.createDelivery(staff, { material_id: 6, image });
    expect(saved.verdict).toBe("substitution");
    expect(
      (await g.listPending(supervisor, {})).some((d) => d.id === saved.id),
    ).toBe(true);
  });
  it("requires a reason, preserves original verdict/time and conflicts on repeat", async () => {
    const before = (await g.listPending(supervisor, {}))[0];
    await expect(
      g.decide(supervisor, 102, { decision: "accept", reason: "  " }),
    ).rejects.toMatchObject({ status: 422 });
    const decided = await g.decide(supervisor, 102, {
      decision: "reject",
      reason: "Changed brand; return to supplier.",
    });
    expect(decided).toMatchObject({
      status: "rejected",
      verdict: "substitution",
      created_at: before.created_at,
    });
    await expect(
      g.decide(supervisor, 102, { decision: "accept", reason: "Other review" }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await g.listActivity(supervisor, {}))[0].reason).toBe(
      "Changed brand; return to supplier.",
    );
  });
  it("does not expose another SME delivery by id", async () => {
    await expect(
      g.decide({ ...supervisor, tenant: "Crescent Caterer SAMPLE" }, 102, {
        decision: "reject",
        reason: "Wrong tenant",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("accepts only prepared renewal and updates both linked masterlists", async () => {
    const supplier = { role: "supplier", tenant: "1" };
    const input = preparedRenewal("1");
    await expect(
      g.renewCertificate(supplier, {
        ...input,
        scope: [{ product_name: "Another product", brand: null }],
      }),
    ).rejects.toMatchObject({ name: "UnsupportedCapabilityError" });
    await g.renewCertificate(supplier, input);
    for (const tenant of ["Sunrise Bakery SAMPLE", "Crescent Caterer SAMPLE"])
      expect(
        (await g.listMaterials({ ...staff, tenant }, {})).every(
          (m) => m.coverage_status === "covered",
        ),
      ).toBe(true);
    expect(
      (await g.listCertificates(supplier, {})).filter(
        (c) => c.status === "active",
      ),
    ).toHaveLength(1);
  });
  it("keeps independent instances transient and resettable", async () => {
    await g.decide(supervisor, 102, {
      decision: "accept",
      reason: "Inspected separately.",
    });
    expect(
      await createPreviewGateway().listPending(supervisor, {}),
    ).toHaveLength(2);
    await g.resetPreview();
    expect(await g.listPending(supervisor, {})).toHaveLength(2);
  });
});
