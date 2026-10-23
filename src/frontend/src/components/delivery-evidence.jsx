import React from "react";
import { PhotoViewer } from "./photo-viewer.jsx";
import { RuleStatus } from "./status.jsx";
import { ChevronDown } from "lucide-react";
export const ruleLabels = {
  R1: "Readable label",
  R2: "Brand and manufacturer",
  R3: "Certificate scope (covers this product and brand)",
  R4: "Certificate expiry (is current)",
  R5: "Recognised issuer (on demo recognised list)",
};
export function RuleChecklist({ rules = [] }) {
  return (
    <section className="rule-checklist" aria-label="Coverage checks">
      <h2>Five checks for certificate coverage</h2>
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
  const extraction = delivery.extracted;
  const r2 = delivery.rule_results.find((r) => r.rule === "R2");
  const rows = [
    ["Product", "product_name", material?.name],
    ["Brand", "brand", material?.approved_brand],
    ["Manufacturer", "manufacturer", material?.approved_manufacturer],
  ];
  return (
    <section className="comparison">
      <h2>Approved material vs read from label</h2>
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
            <tr key={key}>
              <th scope="row">{name}</th>
              <td>{approved || "Approved record unavailable"}</td>
              <td
                className={
                  r2?.passed === false &&
                  key !== "product_name" &&
                  extraction?.[key] &&
                  extraction[key] !== approved
                    ? "mismatch"
                    : ""
                }
              >
                {extraction?.[key] || <span className="muted">Not read</span>}
                {r2?.passed === false &&
                  key !== "product_name" &&
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
            ? "Detected"
            : extraction?.halal_mark_present === false
              ? "Not detected"
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
        <Comparison material={material} delivery={delivery} />
        <RuleChecklist rules={delivery.rule_results} />
      </div>
    </div>
  );
}
