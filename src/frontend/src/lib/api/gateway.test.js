import { it, expect, vi } from "vitest";
import { createLiveGateway } from "./gateway.js";
import { person, people } from "../../test/people.js";
it("loads public people without a previous workspace's headers", async () => {
  const fetchImpl = vi.fn(async () => new Response(JSON.stringify(people)));
  const gateway = createLiveGateway({ fetchImpl });
  await expect(gateway.listPeople()).resolves.toEqual(people);
  expect(fetchImpl.mock.calls[0][0]).toContain("/api/people");
  expect([...fetchImpl.mock.calls[0][1].headers.keys()]).toEqual([]);
});
it("captures three identity headers for protected JSON and reviewer photos", async () => {
  const fetchImpl = vi.fn(async () => new Response("[]"));
  const gateway = createLiveGateway({ fetchImpl }),
    identity = person(7);
  const request = gateway.listRenewals(identity);
  identity.person_id = 5;
  await request;
  await gateway.readImage(person(7), "/api/certificates/1/image");
  expect(fetchImpl.mock.calls[0][1].headers.get("X-Demo-Person")).toBe("7");
  expect(fetchImpl.mock.calls[0][1].headers.get("X-Demo-Tenant")).toBe(
    "registry",
  );
  expect(fetchImpl.mock.calls[1][1].headers.get("X-Demo-Role")).toBe(
    "reviewer",
  );
});
it("never sends a legacy identity or an unsupported live Hold", async () => {
  const fetchImpl = vi.fn(),
    gateway = createLiveGateway({ fetchImpl });
  await expect(
    gateway.listMaterials({ role: "staff", tenant: "Sunrise Bakery SAMPLE" }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    gateway.decide(person(2), 1, {
      decision: "hold",
      reason: "Check brand",
      next_step: "request_product_details",
    }),
  ).rejects.toThrow(/not available/i);
  expect(fetchImpl).not.toHaveBeenCalled();
});
it("posts reviewer decisions with notes and returns backend conflicts", async () => {
  const fetchImpl = vi.fn(
    async () =>
      new Response(JSON.stringify({ detail: "Renewal already reviewed" }), {
        status: 409,
      }),
  );
  await expect(
    createLiveGateway({ fetchImpl }).decideRenewal(person(7), 5, {
      decision: "verify",
      note: "Matches submitted record",
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
    decision: "verify",
    note: "Matches submitted record",
  });
});

it("keeps reviewer image access scoped to certificates", async () => {
  const fetchImpl = vi.fn();
  await expect(
    createLiveGateway({ fetchImpl }).readImage(
      person(7),
      "/api/deliveries/1/image",
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(fetchImpl).not.toHaveBeenCalled();
});
