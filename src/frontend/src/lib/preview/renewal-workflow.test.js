import { it, expect } from "vitest";
import { createPreviewGateway, preparedRenewal } from "./gateway.js";
import { person } from "../../test/people.js";
it("keeps the active certificate until a named reviewer verifies the renewal", async () => {
  const g = createPreviewGateway(),
    before = await g.listCertificates(person(5));
  const submitted = await g.renewCertificate(person(5), preparedRenewal("1"));
  expect(submitted.status).toBe("pending");
  expect(
    (await g.listCertificates(person(5))).find((c) => c.id === before[0].id)
      .status,
  ).toBe("active");
  await expect(
    g.renewCertificate(person(5), preparedRenewal("1")),
  ).rejects.toMatchObject({ status: 409 });
  const queue = await g.listRenewals(person(7));
  expect(queue[0].current.id).toBe(before[0].id);
  const verified = await g.decideRenewal(person(7), submitted.id, {
    decision: "verify",
    note: "Checked against the submitted record",
  });
  expect(verified).toMatchObject({ status: "active", reviewed_by: "Nadia" });
  expect(
    (await g.listCertificates(person(5))).find((c) => c.id === before[0].id)
      .status,
  ).toBe("superseded");
  await expect(
    g.decideRenewal(person(7), submitted.id, {
      decision: "reject",
      note: "Too late",
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it("requires a Hold next step and permits later acceptance without re-holding", async () => {
  const g = createPreviewGateway();
  await expect(
    g.decide(person(2), 102, { decision: "hold", reason: "Brand differs" }),
  ).rejects.toMatchObject({ status: 422 });
  const held = await g.decide(person(2), 102, {
    decision: "hold",
    reason: "Brand differs",
    next_step: "request_product_details",
  });
  expect(held.status).toBe("on_hold");
  expect(await g.listOnHold(person(2))).toHaveLength(1);
  await expect(
    g.decide(person(2), 102, {
      decision: "hold",
      reason: "Again",
      next_step: "request_product_details",
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (
      await g.decide(person(2), 102, {
        decision: "accept",
        reason: "Reviewed supplied details",
      })
    ).status,
  ).toBe("accepted");
});

it("lists prepared renewals in submission order across suppliers", async () => {
  const g = createPreviewGateway(),
    first = await g.renewCertificate(person(6), preparedRenewal("2")),
    second = await g.renewCertificate(person(5), preparedRenewal("1"));
  expect((await g.listRenewals(person(7))).map((r) => r.renewal.id)).toEqual([
    first.id,
    second.id,
  ]);
});
