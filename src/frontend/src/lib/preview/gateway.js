import data from "./data.json";
import { copy, createPreviewStore } from "./store.js";
import { ApiError, UnsupportedCapabilityError } from "../api/client.js";
export const previewCases = data.cases.map(
  ({ id, title, image, responses }) => ({
    id,
    title,
    image,
    materialIds: Object.keys(responses).map(Number),
  }),
);
export function preparedRenewal(supplierId) {
  return copy(data.renewals[String(supplierId)]);
}
async function bytesOf(file) {
  if (file.arrayBuffer) return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
async function hash(file) {
  if (!crypto.subtle)
    throw new UnsupportedCapabilityError(
      "Prepared photo matching needs a secure browser connection.",
    );
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", await bytesOf(file)),
    ),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export function createPreviewGateway() {
  let store = createPreviewStore();
  function identity(context, roles) {
    const ctx = { ...context };
    if (
      !roles.includes(ctx.role) ||
      !(ctx.role === "supplier"
        ? data.certificates[ctx.tenant]
        : data.deliveries[ctx.tenant])
    )
      throw new ApiError(403, "This workspace can't open that view.");
    return ctx;
  }
  function timestamp() {
    return new Date(Date.UTC(2026, 9, 22, 2, 40, store.tick++)).toISOString();
  }
  function event(tenant, ctx, action, delivery_id, reason) {
    store.activity[tenant].unshift({
      id: store.nextId++,
      actor:
        ctx.role === "supplier"
          ? data.certificates[ctx.tenant][0].holder_name
          : ctx.role === "staff"
            ? "Receiving staff SAMPLE"
            : "Halal supervisor SAMPLE",
      role: ctx.role,
      action,
      delivery_id,
      reason,
      created_at: timestamp(),
    });
  }
  return {
    mode: "preview",
    async listMaterials(context, { signal } = {}) {
      const ctx = identity(context, ["staff", "supervisor"]);
      signal?.throwIfAborted();
      return copy(
        data.materials[store.renewed.map(Number).join("")][ctx.tenant],
      );
    },
    async listPending(context, { signal } = {}) {
      const ctx = identity(context, ["supervisor"]);
      signal?.throwIfAborted();
      return copy(
        store.deliveries[ctx.tenant].filter(
          (d) => d.status === "pending_review",
        ),
      );
    },
    async listHistory(context, { signal } = {}) {
      const ctx = identity(context, ["supervisor"]);
      signal?.throwIfAborted();
      return copy(
        store.deliveries[ctx.tenant].filter(
          (d) => d.status !== "pending_review",
        ),
      );
    },
    async listActivity(context, { signal } = {}) {
      const ctx = identity(context, ["supervisor"]);
      signal?.throwIfAborted();
      return copy(store.activity[ctx.tenant]).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
    },
    async listCertificates(context, { signal } = {}) {
      const ctx = identity(context, ["supplier"]);
      signal?.throwIfAborted();
      return copy(store.certificates[ctx.tenant]);
    },
    async createDelivery(context, { material_id, image }) {
      const ctx = identity(context, ["staff"]);
      const startedIn = store;
      const digest = await hash(image);
      if (store !== startedIn)
        throw new UnsupportedCapabilityError(
          "The preview was reset before this check completed. Choose the prepared photo again.",
        );
      const prepared = data.cases.find(
        (c) => c.sha256 === digest && c.responses[String(material_id)],
      );
      if (
        !prepared ||
        !data.materials["00"][ctx.tenant].some(
          (m) => m.id === Number(material_id),
        )
      )
        throw new UnsupportedCapabilityError(
          "This preview only checks its prepared photo and material pairs. Choose a prepared example, or use the backend for another photo.",
        );
      const saved = {
        ...copy(
          prepared.responses_by_renewal[store.renewed.map(Number).join("")][
            String(material_id)
          ],
        ),
        id: store.nextId++,
        created_at: timestamp(),
      };
      store.deliveries[ctx.tenant].push(saved);
      event(ctx.tenant, ctx, saved.status, saved.id, null);
      return copy(saved);
    },
    async decide(context, id, { decision, reason }) {
      const ctx = identity(context, ["supervisor"]);
      const record = store.deliveries[ctx.tenant].find((d) => d.id === id);
      if (!record)
        throw new ApiError(404, "Delivery not found in this workspace.");
      if (record.status !== "pending_review")
        throw new ApiError(409, "This delivery was already decided.");
      if (!["accept", "reject"].includes(decision) || !reason?.trim())
        throw new ApiError(422, "Enter a decision and a reason.", {
          reason: "Enter a reason for this decision.",
        });
      Object.assign(record, {
        status: decision === "accept" ? "accepted" : "rejected",
        reason: reason.trim(),
        decided_by:
          ctx.role === "staff"
            ? "Receiving staff SAMPLE"
            : "Halal supervisor SAMPLE",
      });
      event(ctx.tenant, ctx, record.status, id, record.reason);
      return copy(record);
    },
    async renewCertificate(context, input) {
      const ctx = identity(context, ["supplier"]);
      const prepared = data.renewals[ctx.tenant];
      const fields = [
        "issuer",
        "cert_no",
        "holder_name",
        "expiry_date",
        "scope",
      ];
      if (
        input.image ||
        fields.some(
          (k) => JSON.stringify(input[k]) !== JSON.stringify(prepared[k]),
        )
      )
        throw new UnsupportedCapabilityError(
          "This preview can publish only the prepared renewal. Other certificate changes require the backend.",
        );
      if (store.renewed[Number(ctx.tenant) - 1])
        throw new ApiError(
          409,
          "This prepared renewal has already been published. Reset the preview to repeat it.",
        );
      const records = store.certificates[ctx.tenant];
      records.forEach((c) => {
        if (c.status === "active") c.status = "superseded";
      });
      const saved = {
        ...copy(prepared),
        id: store.nextId++,
        supplier_id: Number(ctx.tenant),
        image: null,
        status: "active",
      };
      records.unshift(saved);
      store.renewed[Number(ctx.tenant) - 1] = true;
      for (const tenant of Object.keys(store.activity))
        event(tenant, ctx, "certificate_renewed", null, null);
      return copy(saved);
    },
    async readImage(context, reference, { signal } = {}) {
      identity(context, ["staff", "supervisor", "supplier"]);
      if (!data.cases.some((c) => c.image === reference))
        throw new UnsupportedCapabilityError(
          "This image is not a prepared preview asset.",
        );
      const response = await fetch(reference, { signal });
      if (!response.ok)
        throw new ApiError(response.status, "We couldn't load this photo.");
      return response.blob();
    },
    async resetPreview() {
      store = createPreviewStore();
    },
  };
}
