import {
  createTransport,
  ApiError,
  UnsupportedCapabilityError,
} from "./client.js";
export { ApiError, UnsupportedCapabilityError } from "./client.js";
export function createLiveGateway(options) {
  const { request, requestPublic } = createTransport(options);
  const read =
    (path, roles) =>
    (context, { signal } = {}) =>
      request(path, { context, roles, signal });
  return {
    mode: "live",
    capabilities: { hold: false, expiry: true, certificateExtract: false },
    listPeople: (options) => requestPublic("/api/people", options),
    readHealth: (options) => requestPublic("/api/health", options),
    listMaterials: read("/api/materials", ["staff", "supervisor"]),
    listPending: read("/api/deliveries?status=pending_review", ["supervisor"]),
    listActivity: read("/api/activity", ["supervisor"]),
    listCertificates: read("/api/certificates", ["supplier"]),
    listRenewals: read("/api/registry/renewals", ["reviewer"]),
    async listOnHold() {
      throw new UnsupportedCapabilityError(
        "Held deliveries are not available from the connected backend yet.",
      );
    },
    runExpiryCheck(context) {
      return request("/api/registry/expiry-check", {
        context,
        roles: ["reviewer"],
        method: "POST",
      });
    },
    decideRenewal(context, id, input) {
      if (!Number.isInteger(id) || id <= 0)
        return Promise.reject(new ApiError(404, "Renewal not found."));
      return request(`/api/registry/renewals/${id}/decision`, {
        context,
        roles: ["reviewer"],
        method: "POST",
        body: input,
      });
    },
    createDelivery(context, { material_id, image }) {
      if (
        !Number.isInteger(Number(material_id)) ||
        Number(material_id) <= 0 ||
        !image
      )
        return Promise.reject(
          new ApiError(422, "Choose a material and photo."),
        );
      const body = new FormData();
      body.set("material_id", String(Number(material_id)));
      body.set("image", image);
      return request("/api/deliveries", {
        context,
        roles: ["staff"],
        method: "POST",
        body,
      });
    },
    decide(context, id, input) {
      if (!Number.isInteger(id) || id <= 0)
        return Promise.reject(new ApiError(404, "Delivery not found."));
      return request("/api/deliveries/" + id + "/decision", {
        context,
        roles: ["supervisor"],
        method: "POST",
        body: input,
      });
    },
    async extractCertificate(context, { image }, { signal } = {}) {
      if (!image)
        return Promise.reject(new ApiError(422, "Choose a certificate image."));
      const body = new FormData();
      body.set("image", image);
      try {
        return await request("/api/certificates/extract", {
          context,
          roles: ["supplier"],
          method: "POST",
          body,
          signal,
        });
      } catch (error) {
        if (error.status === 0)
          throw new ApiError(
            0,
            "The image could not be read. Your draft is unchanged. Try again or enter the details manually.",
          );
        throw error;
      }
    },
    renewCertificate(context, input) {
      const body = new FormData();
      for (const key of ["issuer", "cert_no", "holder_name", "expiry_date"])
        body.set(key, input[key]);
      body.set("scope", JSON.stringify(input.scope));
      if (input.image) body.set("image", input.image);
      return request("/api/certificates", {
        context,
        roles: ["supplier"],
        method: "POST",
        body,
      });
    },
    readImage: (context, reference, { signal } = {}) => {
      if (
        context?.role === "reviewer" &&
        !/^\/api\/certificates\/[1-9]\d*\/image$/.test(reference)
      )
        return Promise.reject(
          new ApiError(
            403,
            "Registry reviewers can open certificate images only.",
          ),
        );
      return request(reference, {
        context,
        roles: ["staff", "supervisor", "supplier", "reviewer"],
        signal,
        image: true,
      });
    },
    listHistory: async () => {
      throw new UnsupportedCapabilityError(
        "Delivery history is not available from the backend yet.",
      );
    },
    resetPreview: async () => {
      throw new UnsupportedCapabilityError(
        "Reset is only available in the prepared preview.",
      );
    },
  };
}
