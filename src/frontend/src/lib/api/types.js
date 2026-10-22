// Shapes of the API contract in "Halal Supplier Control: architecture".
// Keep these in sync with the FastAPI backend (src/backend/main.py).

export const ROLES = ['staff', 'supervisor', 'supplier'];

/** verdict: first failing rule, R1 to R5 */
export const VERDICTS = [
  'covered',
  'expiring',
  'substitution',
  'not_covered',
  'needs_human',
];

/** auto_accepted (covered or expiring), pending_review (everything else), then accepted or rejected */
export const DELIVERY_STATUSES = [
  'auto_accepted',
  'pending_review',
  'accepted',
  'rejected',
];

/** Material coverage, computed on read from the supplier's active certificate */
export const COVERAGES = ['covered', 'expiring', 'not_covered'];

export const CERTIFICATE_STATUSES = ['active', 'superseded'];

/**
 * @typedef {Object} Material
 * @property {string} id
 * @property {string} name
 * @property {string} supplier_id
 * @property {string} supplier_name
 * @property {string} brand
 * @property {string} manufacturer
 * @property {{id: string, cert_no: string, issuer: string, expiry_date: string} | null} certificate
 * @property {'covered'|'expiring'|'not_covered'} coverage
 * @property {string} coverage_detail
 */

/**
 * Output of extract_label (JSON schema sent to vLLM)
 * @typedef {Object} LabelExtraction
 * @property {string|null} product_name
 * @property {string|null} brand
 * @property {string|null} manufacturer
 * @property {boolean|null} halal_mark_present
 */

/**
 * @typedef {Object} RuleResult
 * @property {'R1'|'R2'|'R3'|'R4'|'R5'} rule
 * @property {boolean} passed
 * @property {string} detail
 */

/**
 * Response of POST /api/deliveries and items of GET /api/deliveries
 * @typedef {Object} Delivery
 * @property {string} id
 * @property {string} material_id
 * @property {string} material_name
 * @property {string} supplier_name
 * @property {string|null} image_url
 * @property {LabelExtraction|null} extracted
 * @property {RuleResult[]} rule_results
 * @property {string} verdict
 * @property {string} status
 * @property {string|null} error
 * @property {string} created_at
 * @property {string} created_by
 * @property {{decision: 'accept'|'reject', reason: string, actor: string, decided_at: string} | null} decision
 */

/**
 * @typedef {Object} ActivityEntry
 * @property {string} id
 * @property {string} actor
 * @property {'staff'|'supervisor'|'supplier'|'system'} role
 * @property {string} action
 * @property {string} detail
 * @property {string} created_at
 */

/**
 * @typedef {Object} Certificate
 * @property {string} id
 * @property {string} supplier_id
 * @property {string} issuer
 * @property {string} cert_no
 * @property {string} holder_name
 * @property {string} expiry_date  YYYY-MM-DD
 * @property {string[]} scope
 * @property {string|null} image_url
 * @property {'active'|'superseded'} status
 * @property {string} created_at
 */

/**
 * Simulated Orbyte login. Sent as X-Demo-Role / X-Demo-Tenant headers.
 * For the supplier role, tenant is the supplier id.
 * @typedef {Object} Session
 * @property {'staff'|'supervisor'|'supplier'} role
 * @property {string} tenant
 */

export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   */
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
