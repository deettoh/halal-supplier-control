// API client for the Halal Supplier Control contract.
//
// Mode is chosen by VITE_API_MODE:
//   "demo" (default) - in-browser demo backend (src/lib/api/demo.ts)
//   "live"           - the FastAPI backend at `${BASE_URL}api` (or VITE_API_BASE)
//
// Every live request carries X-Demo-Role and X-Demo-Tenant headers.
import { demoApi } from './demo';
import { ApiError } from './types';
export const API_MODE =
  import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'demo';
const API_BASE =
  import.meta.env.VITE_API_BASE ?? `${import.meta.env.BASE_URL}api`;
async function request(s, path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('X-Demo-Role', s.role);
  headers.set('X-Demo-Tenant', s.tenant);
  if (init.body && !(init.body instanceof FormData))
    headers.set('Content-Type', 'application/json');
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message =
        typeof body.detail === 'string'
          ? body.detail
          : (body.error ?? JSON.stringify(body.detail ?? body));
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined;
  return await res.json();
}
const liveApi = {
  listMaterials: (s) => request(s, '/materials'),
  createDelivery: (s, input) => {
    const form = new FormData();
    form.append('material_id', input.material_id);
    form.append('image', input.image);
    return request(s, '/deliveries', { method: 'POST', body: form });
  },
  listDeliveries: (s, status) =>
    request(s, `/deliveries${status ? `?status=${status}` : ''}`),
  decide: (s, id, input) =>
    request(s, `/deliveries/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  listActivity: (s) => request(s, '/activity'),
  listCertificates: (s) => request(s, '/certificates'),
  createCertificate: (s, input) => {
    const form = new FormData();
    form.append('issuer', input.issuer);
    form.append('cert_no', input.cert_no);
    form.append('holder_name', input.holder_name);
    form.append('expiry_date', input.expiry_date);
    form.append('scope', input.scope.join(','));
    if (input.image) form.append('image', input.image);
    return request(s, '/certificates', { method: 'POST', body: form });
  },
  /** Stretch: POST /api/certificates/extract */
  extractCertificate: (s, image) => {
    const form = new FormData();
    form.append('image', image);
    return request(s, '/certificates/extract', {
      method: 'POST',
      body: form,
    });
  },
  resetDemo: async () => {
    throw new ApiError(501, 'Reset the demo from the backend reset command');
  },
};
export const api = API_MODE === 'live' ? liveApi : { ...liveApi, ...demoApi };
