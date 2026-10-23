import {
  createTransport,
  ApiError,
  UnsupportedCapabilityError,
} from "./client.js";
export { ApiError, UnsupportedCapabilityError } from "./client.js";
export function createLiveGateway(options) {
  const { request } = createTransport(options);
  const read =
    (path, roles) =>
    (context, { signal } = {}) =>
      request(path, { context, roles, signal });
  return {
    mode: "live",
    listMaterials: read("/api/materials", ["staff", "supervisor"]),
    listPending: read("/api/deliveries?status=pending_review", ["supervisor"]),
    listActivity: read("/api/activity", ["supervisor"]),
    listCertificates: read("/api/certificates", ["supplier"]),
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
    readImage: (context, reference, { signal } = {}) =>
      request(reference, {
        context,
        roles: ["staff", "supervisor", "supplier"],
        signal,
        image: true,
      }),
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
