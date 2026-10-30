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
    const person = data.people.find(
      (p) =>
        p.id === ctx.person_id &&
        p.role === ctx.role &&
        p.tenant === ctx.tenant,
    );
    if (!roles.includes(ctx.role) || !person)
      throw new ApiError(403, "This person can't open that view.");
    Object.assign(ctx, { name: person.name, title: person.title });
    return ctx;
  }
  function timestamp() {
    return new Date(Date.UTC(2026, 9, 22, 2, 40, store.tick++)).toISOString();
  }
  function linkedTenants(supplierId) {
    return Object.keys(store.activity).filter((tenant) =>
      data.materials["00"][tenant].some(
        (m) => m.supplier_id === Number(supplierId),
      ),
    );
  }
  function event(tenant, ctx, action, delivery_id, reason, supplierId = null) {
    const delivery = store.deliveries[tenant].find((d) => d.id === delivery_id);
    const material =
      delivery && data.source_materials[String(delivery.material_id)];
    store.activity[tenant].unshift({
      id: store.nextId++,
      actor: ctx.name,
      actor_title: ctx.title,
      material_name: material?.name || null,
      verdict: delivery?.verdict || null,
      supplier_name: supplierId
        ? data.suppliers.find((s) => s.id === Number(supplierId))?.name || null
        : null,
      role: ctx.role,
      action,
      delivery_id,
      reason,
      created_at: timestamp(),
    });
  }
  return {
    mode: "preview",
    capabilities: { hold: true, expiry: true, certificateExtract: false },
    async listPeople({ signal } = {}) {
      signal?.throwIfAborted();
      return copy(data.people);
    },
    async readHealth() {
      return { status: "ok", contract_version: "prepared-preview" };
    },
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
          (d) => !["pending_review", "on_hold"].includes(d.status),
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
    async decide(context, id, { decision, reason, next_step }) {
      const ctx = identity(context, ["supervisor"]);
      const record = store.deliveries[ctx.tenant].find((d) => d.id === id);
      if (!record)
        throw new ApiError(404, "Delivery not found in this workspace.");
      if (
        !["pending_review", "on_hold"].includes(record.status) ||
        (record.status === "on_hold" && decision === "hold")
      )
        throw new ApiError(409, "This delivery was already decided.");
      if (
        !["accept", "reject", "hold"].includes(decision) ||
        !reason?.trim() ||
        (decision === "hold" &&
          !["request_certificate", "request_product_details"].includes(
            next_step,
          ))
      )
        throw new ApiError(422, "Enter a decision and a reason.", {
          reason: "Enter a reason for this decision.",
        });
      Object.assign(record, {
        status:
          decision === "hold"
            ? "on_hold"
            : decision === "accept"
              ? "accepted"
              : "rejected",
        next_step: decision === "hold" ? next_step : null,
        reason: reason.trim(),
        decided_by: ctx.name,
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
          "This preview can submit only the prepared renewal. Other certificate changes require the backend.",
        );
      const records = store.certificates[ctx.tenant];
      if (records.some((c) => c.status === "pending"))
        throw new ApiError(409, "A renewal is already waiting for review");
      const saved = {
        ...copy(prepared),
        id: store.nextId++,
        supplier_id: Number(ctx.tenant),
        image: null,
        status: "pending",
        review_note: null,
        reviewed_by: null,
      };
      records.unshift(saved);
      for (const tenant of linkedTenants(ctx.tenant))
        event(tenant, ctx, "certificate_submitted", null, null, ctx.tenant);
      return copy(saved);
    },
    async listOnHold(context, { signal } = {}) {
      const ctx = identity(context, ["supervisor"]);
      signal?.throwIfAborted();
      return copy(
        store.deliveries[ctx.tenant].filter((d) => d.status === "on_hold"),
      );
    },
    async listRenewals(context, { signal } = {}) {
      identity(context, ["reviewer"]);
      signal?.throwIfAborted();
      return Object.entries(store.certificates)
        .flatMap(([id, records]) =>
          records
            .filter((c) => c.status === "pending")
            .map((renewal) => ({
              renewal: copy(renewal),
              current: copy(records.find((c) => c.status === "active") || null),
              supplier_name: data.certificates[id][0].holder_name,
            })),
        )
        .sort((a, b) => a.renewal.id - b.renewal.id);
    },
    async decideRenewal(context, id, { decision, note }) {
      const ctx = identity(context, ["reviewer"]);
      if (!["verify", "reject"].includes(decision) || !note?.trim())
        throw new ApiError(422, "Add a review note.");
      const records = Object.values(store.certificates).find((rows) =>
        rows.some((c) => c.id === id),
      );
      const row = records?.find((c) => c.id === id);
      if (!row) throw new ApiError(404, "Renewal not found");
      if (row.status !== "pending")
        throw new ApiError(409, "Renewal already reviewed");
      if (decision === "verify") {
        records.forEach((c) => {
          if (c.status === "active") c.status = "superseded";
        });
        store.renewed[row.supplier_id - 1] = true;
      }
      Object.assign(row, {
        status: decision === "verify" ? "active" : "rejected",
        review_note: note.trim(),
        reviewed_by: ctx.name,
      });
      for (const tenant of linkedTenants(row.supplier_id))
        event(
          tenant,
          ctx,
          decision === "verify"
            ? "certificate_renewed"
            : "certificate_rejected",
          null,
          note.trim(),
          row.supplier_id,
        );
      return copy(row);
    },
    async runExpiryCheck(context) {
      const ctx = identity(context, ["reviewer"]);
      let requests_created = 0,
        certificates_checked = 0;
      const expiring = new Set(
        Object.values(data.materials[store.renewed.map(Number).join("")])
          .flat()
          .filter((m) => m.coverage_status === "expiring")
          .map((m) => m.supplier_id),
      );
      for (const records of Object.values(store.certificates))
        for (const c of records.filter((c) => c.status === "active")) {
          certificates_checked++;
          if (expiring.has(c.supplier_id) && !c.renewal_requested_on) {
            c.renewal_requested_on = data.date;
            requests_created++;
            for (const tenant of linkedTenants(c.supplier_id))
              event(
                tenant,
                ctx,
                "renewal_requested",
                null,
                "Renewal requested in prepared preview",
                c.supplier_id,
              );
          }
        }
      return { certificates_checked, requests_created };
    },
    async readImage(context, reference, { signal } = {}) {
      identity(context, ["staff", "supervisor", "supplier", "reviewer"]);
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
