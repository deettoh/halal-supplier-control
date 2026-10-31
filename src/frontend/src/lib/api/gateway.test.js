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
it("never sends a legacy identity", async () => {
  const fetchImpl = vi.fn(),
    gateway = createLiveGateway({ fetchImpl });
  await expect(
    gateway.listMaterials({ role: "staff", tenant: "Sunrise Bakery SAMPLE" }),
  ).rejects.toMatchObject({ status: 403 });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it("posts Hold with its next step, reads the held queue, then resolves without next_step", async () => {
  const fetchImpl = vi.fn(async () => new Response("[]"));
  const gateway = createLiveGateway({ fetchImpl });
  expect(gateway.capabilities.hold).toBe(true);
  const hold = {
    decision: "hold",
    reason: "Check brand",
    next_step: "request_product_details",
  };
  await gateway.decide(person(2), 1, hold);
  await gateway.listOnHold(person(2));
  await gateway.decide(person(2), 1, {
    decision: "accept",
    reason: "Checked documents",
  });
  expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual(hold);
  expect(fetchImpl.mock.calls[1][0]).toContain(
    "/api/deliveries?status=on_hold",
  );
  expect(JSON.parse(fetchImpl.mock.calls[2][1].body)).not.toHaveProperty(
    "next_step",
  );
  for (const [, options] of fetchImpl.mock.calls) {
    expect(options.headers.get("X-Demo-Person")).toBe("2");
    expect(options.headers.get("X-Demo-Role")).toBe("supervisor");
  }
});

it("extracts a certificate with supplier identity and multipart image without submitting a renewal", async () => {
  const fetchImpl = vi.fn(
    async () => new Response('{"extracted":null,"error":"Unreadable image"}'),
  );
  const gateway = createLiveGateway({ fetchImpl });
  const image = new File(["photo"], "certificate.jpg", { type: "image/jpeg" });
  expect(gateway.capabilities.certificateExtract).toBe(true);
  await expect(
    gateway.extractCertificate(person(5), { image }),
  ).resolves.toMatchObject({ extracted: null });
  expect(fetchImpl).toHaveBeenCalledOnce();
  expect(fetchImpl.mock.calls[0][0]).toContain("/api/certificates/extract");
  const options = fetchImpl.mock.calls[0][1];
  expect(options.body.get("image")).toBe(image);
  expect(options.headers.has("Content-Type")).toBe(false);
  expect(options.headers.get("X-Demo-Person")).toBe("5");
  expect(options.headers.get("X-Demo-Tenant")).toBe("1");
  await expect(
    gateway.extractCertificate(person(1), { image }),
  ).rejects.toMatchObject({ status: 403 });
  expect(fetchImpl).toHaveBeenCalledOnce();
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

it("does not imply a renewal was saved when the read-only extraction request loses its connection", async () => {
  const gateway = createLiveGateway({
    fetchImpl: vi.fn(async () => {
      throw new TypeError("Network failure");
    }),
  });
  await expect(
    gateway.extractCertificate(person(5), {
      image: new File(["photo"], "certificate.png", { type: "image/png" }),
    }),
  ).rejects.toMatchObject({
    status: 0,
    message: expect.stringContaining("Your draft is unchanged"),
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
