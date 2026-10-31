import React, { useId, useState } from "react";
import { PhotoViewer } from "./photo-viewer.jsx";
import { RuleStatus } from "./status.jsx";
import { ChevronDown } from "lucide-react";
// CSS keeps desktop content fully expanded without adding a visible control.
export function MobileEvidenceDetails({ label, children }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  return (
    <div className="mobile-evidence-disclosure" data-expanded={expanded}>
      <button
        type="button"
        className="button quiet mobile-evidence-toggle"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded((value) => !value)}
      >
        {label}
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      <div id={id} className="mobile-evidence-content">
        {children}
      </div>
    </div>
  );
}
export const ruleLabels = {
  R1: "Readable label",
  R2: "Product, brand and manufacturer",
  R3: "Certificate scope (covers this product and brand)",
  R4: "Certificate expiry (is current)",
  R5: "Recognised issuer (on demo recognised list)",
  R6: "Halal mark on label (visible, not authenticated)",
};
export function RuleChecklist({ rules = [] }) {
  return (
    <section className="rule-checklist" aria-label="Coverage checks">
      <h2>Six checks for this delivery</h2>
      <p className="check-instruction">
        Open a check to read its recorded reason.
      </p>
      <ol>
        {rules.map((r) => (
          <li key={r.rule} data-testid={"rule-" + r.rule}>
            <details>
              <summary>
                <span className="rule-id">{r.rule}</span>
                <span>{ruleLabels[r.rule] || r.rule}</span>
                <RuleStatus passed={r.passed} />
                <ChevronDown
                  className="rule-expansion"
                  size={14}
                  aria-hidden="true"
                />
              </summary>
              <p>{r.detail}</p>
            </details>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function Comparison({ material, delivery }) {
  const [linked, setLinked] = useState(null);
  const extraction = delivery.extracted;
  const r2 = delivery.rule_results.find((r) => r.rule === "R2");
  const rows = [
    ["Product", "product_name", material?.name],
    ["Brand", "brand", material?.approved_brand],
    ["Manufacturer", "manufacturer", material?.approved_manufacturer],
  ];
  return (
    <section className="comparison">
      <h2>Current approved material vs read from label</h2>
      <p className="comparison-hint">Hover, focus or tap a field to compare.</p>
      <table>
        <thead>
          <tr>
            <td></td>
            <th scope="col">Approved material</th>
            <th scope="col">Read from label</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, key, approved]) => (
            <tr key={key} data-linked={linked === key}>
              <th scope="row">
                <button
                  type="button"
                  className="comparison-field"
                  aria-pressed={linked === key}
                  onClick={() => setLinked(linked === key ? null : key)}
                >
                  {name}
                </button>
              </th>
              <td>{approved || "Approved record unavailable"}</td>
              <td
                className={
                  r2?.passed === false &&
                  r2.detail
                    .toLowerCase()
                    .includes(key === "product_name" ? "product" : key) &&
                  extraction?.[key] &&
                  extraction[key] !== approved
                    ? "mismatch"
                    : ""
                }
              >
                {extraction?.[key] || <span className="muted">Not read</span>}
                {r2?.passed === false &&
                  r2.detail
                    .toLowerCase()
                    .includes(key === "product_name" ? "product" : key) &&
                  extraction?.[key] &&
                  extraction[key] !== approved && <small>Does not match</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="observed-mark">
        <dt>Halal mark</dt>
        <dd>
          {extraction?.halal_mark_present === true
            ? "Visible"
            : extraction?.halal_mark_present === false
              ? "Not visible"
              : "Not read"}
        </dd>
      </dl>
    </section>
  );
}
export function DeliveryEvidence({ material, delivery, file }) {
  return (
    <div className="evidence-grid">
      <PhotoViewer reference={delivery.image} file={file} />
      <div className="evidence-reading">
        <Comparison key={delivery.id} material={material} delivery={delivery} />
        <RuleChecklist rules={delivery.rule_results} />
      </div>
    </div>
  );
}

export function firstReviewIssue(delivery) {
  return (
    delivery.rule_results?.find((r) => r.passed !== true)?.detail ||
    delivery.error ||
    "Review the recorded checks before deciding."
  );
}
