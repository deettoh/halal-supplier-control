// In-browser implementation of the API contract, used until the FastAPI
// backend is connected. It applies the same R1-R5 rules, role gates and
// status transitions described in the architecture doc.
import {
  ACTORS,
  DEMO_LABELS,
  RECOGNISED_ISSUERS,
  SEED_ACTIVITY,
  SEED_CERTIFICATES,
  SEED_DELIVERIES,
  SEED_MATERIALS,
  SUPPLIERS,
  TENANTS,
} from './demo-seed';
import { ApiError } from './types';
const STORAGE_KEY = 'hsc-demo-state-v2';
const EXPIRY_WARNING_DAYS = 60;
const MATCH_THRESHOLD = 90;
function freshState() {
  return {
    certificates: structuredClone(SEED_CERTIFICATES),
    deliveries: structuredClone(SEED_DELIVERIES),
    activity: structuredClone(SEED_ACTIVITY),
    seq: 1,
  };
}
let state = load();
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return freshState();
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded (large photos): drop images from older deliveries and retry.
    state.deliveries.forEach((d, i) => {
      if (i > 0) d.image_url = null;
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* keep in memory only */
    }
  }
}
function nextId(prefix) {
  state.seq += 1;
  return `${prefix}-${state.seq}`;
}
function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function daysUntil(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return Math.round((d.getTime() - today().getTime()) / 86_400_000);
}
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
// --- Fuzzy matching (approximates rapidfuzz token_sort_ratio) -------------
function normalise(s) {
  return s
    .toLowerCase()
    .replace(/\b(sdn|bhd|ltd|corp|corporation|co|inc)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}
function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = tmp;
    }
  }
  return dp[b.length];
}
export function similarity(a, b) {
  const x = normalise(a);
  const y = normalise(b);
  if (!x && !y) return 100;
  const len = x.length + y.length;
  return Math.max(
    0,
    Math.round((1 - levenshtein(x, y) / Math.max(len / 2, 1)) * 100),
  );
}
// --- Coverage and rules ---------------------------------------------------
function activeCert(supplierId) {
  return state.certificates.find(
    (c) => c.supplier_id === supplierId && c.status === 'active',
  );
}
function inScope(cert, m) {
  const name = m.name.trim().toLowerCase();
  return cert.scope.some((s) => s.trim().toLowerCase() === name);
}
function coverageFor(m) {
  const cert = activeCert(m.supplier_id);
  if (!cert)
    return { coverage: 'not_covered', detail: 'No active certificate on file' };
  if (!RECOGNISED_ISSUERS.includes(cert.issuer))
    return {
      coverage: 'not_covered',
      detail: 'Issuer not on recognised list',
      cert,
    };
  if (!inScope(cert, m))
    return {
      coverage: 'not_covered',
      detail: 'Product not in certificate scope',
      cert,
    };
  const days = daysUntil(cert.expiry_date);
  if (days < 0)
    return {
      coverage: 'not_covered',
      detail: `Certificate expired ${-days} days ago`,
      cert,
    };
  if (days <= EXPIRY_WARNING_DAYS)
    return { coverage: 'expiring', detail: `Expires in ${days} days`, cert };
  return { coverage: 'covered', detail: `Valid for ${days} more days`, cert };
}
function toMaterial(m) {
  const { coverage, detail, cert } = coverageFor(m);
  return {
    id: m.id,
    name: m.name,
    supplier_id: m.supplier_id,
    supplier_name:
      SUPPLIERS.find((s) => s.id === m.supplier_id)?.name ?? m.supplier_id,
    brand: m.brand,
    manufacturer: m.manufacturer,
    certificate: cert
      ? {
          id: cert.id,
          cert_no: cert.cert_no,
          issuer: cert.issuer,
          expiry_date: cert.expiry_date,
        }
      : null,
    coverage,
    coverage_detail: detail,
  };
}
function evaluate(label, m) {
  const cert = activeCert(m.supplier_id);
  const results = [];
  const r1 =
    !!label && !!label.product_name && !!label.brand && !!label.manufacturer;
  results.push({
    rule: 'R1',
    passed: r1,
    detail: r1
      ? 'Product name, brand and manufacturer extracted'
      : label
        ? `Missing fields: ${['product_name', 'brand', 'manufacturer'].filter((k) => !label[k]).join(', ')}`
        : 'Model returned no valid JSON',
  });
  const brandScore = label?.brand ? similarity(label.brand, m.brand) : 0;
  const mfrScore = label?.manufacturer
    ? similarity(label.manufacturer, m.manufacturer)
    : 0;
  const r2 = r1 && brandScore >= MATCH_THRESHOLD && mfrScore >= MATCH_THRESHOLD;
  results.push({
    rule: 'R2',
    passed: r2,
    detail: r1
      ? `Brand "${label.brand}" vs "${m.brand}" (${brandScore}); manufacturer "${label.manufacturer}" vs "${m.manufacturer}" (${mfrScore})`
      : 'Skipped: label fields not available',
  });
  const r3 = !!cert && inScope(cert, m);
  results.push({
    rule: 'R3',
    passed: r3,
    detail: cert
      ? r3
        ? `"${m.name}" is in scope of ${cert.cert_no}`
        : `"${m.name}" is not in scope of ${cert.cert_no}`
      : 'No active certificate',
  });
  const days = cert ? daysUntil(cert.expiry_date) : -1;
  const r4 = !!cert && days >= 0;
  results.push({
    rule: 'R4',
    passed: r4,
    detail: cert
      ? r4
        ? `Valid until ${cert.expiry_date} (${days} days left)`
        : `Expired on ${cert.expiry_date}`
      : 'No active certificate',
  });
  const r5 = !!cert && RECOGNISED_ISSUERS.includes(cert.issuer);
  results.push({
    rule: 'R5',
    passed: r5,
    detail: cert
      ? r5
        ? `${cert.issuer} is recognised`
        : `${cert.issuer} is not on the recognised list`
      : 'No active certificate',
  });
  let verdict;
  if (!r1) verdict = 'needs_human';
  else if (!r2) verdict = 'substitution';
  else if (!r3 || !r4 || !r5) verdict = 'not_covered';
  else if (days <= EXPIRY_WARNING_DAYS) verdict = 'expiring';
  else verdict = 'covered';
  return { results, verdict };
}
// --- Helpers --------------------------------------------------------------
function actor(s) {
  return ACTORS[`${s.tenant}:${s.role}`] ?? s.role;
}
function log(tenant, s, action, detail) {
  state.activity.unshift({
    id: nextId('act'),
    tenant,
    actor: s ? actor(s) : 'System',
    role: s ? s.role : 'system',
    action,
    detail,
    created_at: new Date().toISOString(),
  });
}
function requireRole(s, roles) {
  if (!roles.includes(s.role))
    throw new ApiError(403, `Role "${s.role}" is not allowed to do this`);
}
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
function stripTenant(row) {
  const { tenant: _t, ...rest } = row;
  return rest;
}
// --- Routes ---------------------------------------------------------------
export const demoApi = {
  async listMaterials(s) {
    await delay();
    requireRole(s, ['staff', 'supervisor']);
    return SEED_MATERIALS.filter((m) => m.tenant === s.tenant).map(toMaterial);
  },
  async createDelivery(s, input) {
    requireRole(s, ['staff']);
    const m = SEED_MATERIALS.find(
      (x) =>
        String(x.id) === String(input.material_id) && x.tenant === s.tenant,
    );
    if (!m) throw new ApiError(404, 'Material not found');
    await delay(1200); // simulated model call
    const cached = DEMO_LABELS.find((l) => l.id === input.demo_label_id);
    const extraction = cached
      ? cached.extraction
      : {
          product_name: m.name,
          brand: m.brand,
          manufacturer: m.manufacturer,
          halal_mark_present: true,
        };
    const error =
      cached && cached.extraction === null
        ? 'Model timeout after 30s (no valid JSON returned)'
        : null;
    const { results, verdict } = evaluate(extraction, m);
    const status =
      verdict === 'covered' || verdict === 'expiring'
        ? 'auto_accepted'
        : 'pending_review';
    const delivery = {
      id: nextId('dlv'),
      tenant: s.tenant,
      material_id: m.id,
      material_name: m.name,
      supplier_name: SUPPLIERS.find((x) => x.id === m.supplier_id)?.name ?? '',
      image_url: await fileToDataUrl(input.image),
      extracted: extraction,
      rule_results: results,
      verdict,
      status,
      error,
      created_at: new Date().toISOString(),
      created_by: actor(s),
      decision: null,
    };
    state.deliveries.unshift(delivery);
    log(s.tenant, s, 'Uploaded label', `${m.name}: label photo submitted`);
    log(
      s.tenant,
      null,
      status === 'auto_accepted'
        ? 'Auto-accepted delivery'
        : 'Flagged delivery',
      `${m.name}: verdict ${verdict}`,
    );
    save();
    return stripTenant(delivery);
  },
  async listDeliveries(s, status) {
    await delay();
    requireRole(s, ['staff', 'supervisor']);
    return state.deliveries
      .filter((d) => d.tenant === s.tenant && (!status || d.status === status))
      .map(stripTenant);
  },
  async decide(s, id, input) {
    await delay();
    requireRole(s, ['supervisor']);
    if (!input.reason || !input.reason.trim())
      throw new ApiError(422, 'A reason is required');
    const d = state.deliveries.find(
      (x) => x.id === id && x.tenant === s.tenant,
    );
    if (!d) throw new ApiError(404, 'Delivery not found');
    if (d.status !== 'pending_review')
      throw new ApiError(409, 'Delivery is not pending review');
    d.status = input.decision === 'accept' ? 'accepted' : 'rejected';
    d.decision = {
      decision: input.decision,
      reason: input.reason.trim(),
      actor: actor(s),
      decided_at: new Date().toISOString(),
    };
    log(
      s.tenant,
      s,
      input.decision === 'accept' ? 'Accepted delivery' : 'Rejected delivery',
      `${d.material_name}: ${input.reason.trim()}`,
    );
    save();
    return stripTenant(d);
  },
  async listActivity(s) {
    await delay();
    requireRole(s, ['supervisor']);
    return state.activity.filter((a) => a.tenant === s.tenant).map(stripTenant);
  },
  async listCertificates(s) {
    await delay();
    requireRole(s, ['supplier']);
    return state.certificates
      .filter((c) => c.supplier_id === s.tenant)
      .sort((a, b) =>
        a.status === b.status
          ? b.expiry_date.localeCompare(a.expiry_date)
          : a.status === 'active'
            ? -1
            : 1,
      );
  },
  async createCertificate(s, input) {
    await delay(600);
    requireRole(s, ['supplier']);
    for (const k of ['issuer', 'cert_no', 'holder_name', 'expiry_date']) {
      if (!input[k] || !String(input[k]).trim())
        throw new ApiError(422, `${k} is required`);
    }
    if (!input.scope.length) throw new ApiError(422, 'scope is required');
    state.certificates.forEach((c) => {
      if (c.supplier_id === s.tenant && c.status === 'active')
        c.status = 'superseded';
    });
    const cert = {
      id: nextId('cert'),
      supplier_id: s.tenant,
      issuer: input.issuer.trim(),
      cert_no: input.cert_no.trim(),
      holder_name: input.holder_name.trim(),
      expiry_date: input.expiry_date,
      scope: input.scope.map((x) => x.trim()).filter(Boolean),
      image_url: input.image ? await fileToDataUrl(input.image) : null,
      status: 'active',
      created_at: new Date().toISOString(),
    };
    state.certificates.push(cert);
    const supplierName =
      SUPPLIERS.find((x) => x.id === s.tenant)?.name ?? s.tenant;
    const linkedTenants = new Set(
      SEED_MATERIALS.filter((m) => m.supplier_id === s.tenant).map(
        (m) => m.tenant,
      ),
    );
    linkedTenants.forEach((t) =>
      log(
        t,
        s,
        'Certificate renewed',
        `${supplierName} renewed ${cert.cert_no}, valid until ${cert.expiry_date}`,
      ),
    );
    save();
    return cert;
  },
  async resetDemo() {
    state = freshState();
    save();
  },
};
export { DEMO_LABELS, TENANTS, SUPPLIERS };
