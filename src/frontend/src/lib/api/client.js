export class ApiError extends Error {
  constructor(status, detail, fields = {}) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}
export class UnsupportedCapabilityError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnsupportedCapabilityError";
  }
}
export function capturedHeaders(context, roles) {
  if (!roles.includes(context?.role) || !context?.tenant?.trim())
    throw new ApiError(403, "This workspace can't open that view.");
  return new Headers({
    "X-Demo-Role": context.role,
    "X-Demo-Tenant": context.tenant,
  });
}
export function createTransport({
  baseUrl = "",
  fetchImpl = globalThis.fetch,
} = {}) {
  const base = new URL(
    baseUrl || "/",
    globalThis.location?.origin || "http://localhost:3000",
  );
  async function request(
    path,
    { context, roles, body, signal, method = "GET", image = false } = {},
  ) {
    const headers = capturedHeaders({ ...context }, roles);
    const url = new URL(path, base);
    if (
      url.origin !== base.origin ||
      !["http:", "https:"].includes(url.protocol)
    )
      throw new UnsupportedCapabilityError(
        "This photo is not served by the configured API. Protected photo access is required.",
      );
    if (body && !(body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetchImpl(url.href, {
        method,
        headers,
        body,
        signal,
        redirect: "error",
      });
    } catch (error) {
      if (error.name === "AbortError") throw error;
      throw new ApiError(
        0,
        method === "GET"
          ? "We couldn't reach the service. Try again."
          : "We haven't received a result. The record may have been saved. Check before submitting again.",
      );
    }
    if (!response.ok) {
      let data;
      try {
        data = await response.json();
      } catch {
        data = {};
      }
      const fields = {};
      if (Array.isArray(data.detail))
        for (const issue of data.detail)
          fields[issue.loc?.slice(1).join(".") || "form"] =
            issue.msg || "Check this value.";
      const detail =
        typeof data.detail === "string"
          ? data.detail
          : Object.values(fields).join(" ") ||
            "The request could not be completed.";
      throw new ApiError(response.status, detail, fields);
    }
    return image ? response.blob() : response.json();
  }
  return { request };
}
