import { person } from "../../test/people.js";
import { describe, it, expect, vi } from "vitest";
import {
  createLiveGateway,
  ApiError,
  UnsupportedCapabilityError,
} from "./gateway.js";
import { formatDate } from "../format.js";
const staff = person(1);
const supervisor = person(2);
const supplier = person(6);
function transport(body, status = 200) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

describe("canonical live transport", () => {
  it("attaches demo headers to both teammate-confirmed image endpoints", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("jpeg", { headers: { "Content-Type": "image/jpeg" } }),
    );
    const gateway = createLiveGateway({
      fetchImpl,
      baseUrl: "https://api.example.test",
    });
    await gateway.readImage(supplier, "/api/certificates/3/image", {});
    await gateway.readImage(supervisor, "/api/deliveries/102/image", {});
    const calls = fetchImpl.mock.calls;
    expect(calls.map(([url]) => url)).toEqual([
      "https://api.example.test/api/certificates/3/image",
      "https://api.example.test/api/deliveries/102/image",
    ]);
    expect(calls[0][1].headers.get("X-Demo-Role")).toBe("supplier");
    expect(calls[0][1].headers.get("X-Demo-Tenant")).toBe("2");
    expect(calls[1][1].headers.get("X-Demo-Role")).toBe("supervisor");
    expect(calls[1][1].headers.get("X-Demo-Tenant")).toBe(
      "Sunrise Bakery SAMPLE",
    );
  });
  it("captures identity headers before a delayed request", async () => {
    const fetchImpl = transport([]);
    const g = createLiveGateway({ fetchImpl, baseUrl: "http://localhost" });
    const ctx = { ...staff };
    const promise = g.listMaterials(ctx, {});
    ctx.tenant = "Crescent Caterer SAMPLE";
    await promise;
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("http://localhost/api/materials");
    expect(init.headers.get("X-Demo-Role")).toBe("staff");
    expect(init.headers.get("X-Demo-Tenant")).toBe("Sunrise Bakery SAMPLE");
  });
  it("sends numeric material id as multipart and leaves boundary to browser", async () => {
    const fetchImpl = transport({ id: 102 }, 201);
    const g = createLiveGateway({ fetchImpl });
    const file = new File(["photo"], "label.png", { type: "image/png" });
    await g.createDelivery(staff, { material_id: 6, image: file });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.body.get("material_id")).toBe("6");
    expect(init.body.get("image")).toBe(file);
    expect(init.headers.has("Content-Type")).toBe(false);
  });
  it("preserves structured optional-brand scope in renewal", async () => {
    const fetchImpl = transport({ id: 5 }, 201);
    const g = createLiveGateway({ fetchImpl });
    await g.renewCertificate(supplier, {
      issuer: "SAMPLE Council",
      cert_no: "SAMPLE-5",
      holder_name: "Supplier SAMPLE",
      expiry_date: "2026-01-01",
      scope: [{ product_name: "Cocoa Powder", brand: null }],
    });
    const body = fetchImpl.mock.calls[0][1].body;
    expect(body.get("scope")).toBe(
      '[{"product_name":"Cocoa Powder","brand":null}]',
    );
    expect(body.has("supplier_id")).toBe(false);
  });
  it("parses field errors and does not silently replace a 501", async () => {
    const invalid = createLiveGateway({
      fetchImpl: transport(
        {
          detail: [
            { loc: ["body", "reason"], msg: "Field required", type: "missing" },
          ],
        },
        422,
      ),
    });
    await expect(
      invalid.decide(supervisor, 102, { decision: "reject", reason: "" }),
    ).rejects.toMatchObject({
      status: 422,
      fields: { reason: "Field required" },
    });
    const unavailable = createLiveGateway({
      fetchImpl: transport({ detail: "Contract only" }, 501),
    });
    await expect(unavailable.listMaterials(staff, {})).rejects.toBeInstanceOf(
      ApiError,
    );
  });
  it("returns a saved needs_human response as successful", async () => {
    const saved = {
      id: 104,
      verdict: "needs_human",
      status: "pending_review",
      extracted: null,
      error: "Label could not be read",
    };
    const g = createLiveGateway({ fetchImpl: transport(saved, 201) });
    await expect(
      g.createDelivery(staff, {
        material_id: 6,
        image: new File(["x"], "x.png"),
      }),
    ).resolves.toEqual(saved);
  });
  it("never calls supervisor pending or history APIs as staff", async () => {
    const fetchImpl = transport([]);
    const g = createLiveGateway({ fetchImpl });
    await expect(g.listPending(staff, {})).rejects.toMatchObject({
      status: 403,
    });
    await expect(g.listHistory(staff, {})).rejects.toBeInstanceOf(
      UnsupportedCapabilityError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("requests only the supported pending status", async () => {
    const fetchImpl = transport([]);
    await createLiveGateway({ fetchImpl }).listPending(supervisor, {});
    expect(fetchImpl.mock.calls[0][0]).toBe(
      "http://localhost:3000/api/deliveries?status=pending_review",
    );
  });
  it("does not leak identity headers to third-party image references", async () => {
    const fetchImpl = transport({});
    const g = createLiveGateway({
      fetchImpl,
      baseUrl: "https://api.example.test",
    });
    await expect(
      g.readImage(supervisor, "https://unapproved.test/photo.png", {}),
    ).rejects.toBeInstanceOf(UnsupportedCapabilityError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("retrieves an authorised image as a blob with captured headers", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response("png", { headers: { "Content-Type": "image/png" } }),
    );
    const g = createLiveGateway({
      fetchImpl,
      baseUrl: "https://api.example.test",
    });
    const blob = await g.readImage(supervisor, "/uploads/102.png", {});
    expect(blob.size).toBe(3);
    expect(fetchImpl.mock.calls[0][1].headers.get("X-Demo-Tenant")).toBe(
      "Sunrise Bakery SAMPLE",
    );
  });
  it("formats calendar dates without timezone shifts", () => {
    expect(formatDate("2026-11-30")).toBe("30 Nov 2026");
    expect(formatDate(null)).toBe("No active certificate");
  });
});
