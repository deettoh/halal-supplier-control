import React from "react";
import { formatDate } from "../lib/format.js";
import { PhotoViewer } from "./photo-viewer.jsx";
const scopeKey = (s) => JSON.stringify([s.product_name, s.brand]);
export function RenewalComparison({ current, renewal }) {
  const currentKeys = new Set(current?.scope.map(scopeKey) || []),
    newKeys = new Set(renewal.scope.map(scopeKey));
  return (
    <section
      className="renewal-comparison"
      aria-label="Current and submitted certificate comparison"
    >
      <div className="comparison-head">
        <h2>Compare the records</h2>
        <p>
          Check the submitted document and scope before recording a decision.
        </p>
      </div>
      <div className="renewal-columns">
        <section>
          <h3>Current certificate</h3>
          {!current && (
            <p className="muted">No current certificate is on file.</p>
          )}
        </section>
        <section>
          <h3>Submitted renewal</h3>
        </section>
      </div>
      <dl className="renewal-field-comparison">
        {[
          ["Certificate number", "cert_no"],
          ["Issuer", "issuer"],
          ["Holder", "holder_name"],
          ["Expiry", "expiry_date"],
        ].map(([title, key]) => (
          <div className="renewal-field-row" key={key}>
            <dt>{title}</dt>
            <dd>
              {current
                ? key === "expiry_date"
                  ? formatDate(current[key])
                  : current[key]
                : "Not on file"}
            </dd>
            <dd
              className={current?.[key] !== renewal[key] ? "changed-value" : ""}
            >
              {key === "expiry_date" ? formatDate(renewal[key]) : renewal[key]}
            </dd>
          </div>
        ))}
      </dl>
      <div className="renewal-columns renewal-scopes">
        {[
          [current, "Current scope"],
          [renewal, "Submitted scope"],
        ].map(([record, title], i) => (
          <section key={title}>
            <h3>{title}</h3>
            <ul>
              {record?.scope.map((s, j) => {
                const changed =
                  i === 0
                    ? !newKeys.has(scopeKey(s))
                    : !currentKeys.has(scopeKey(s));
                return (
                  <li key={j} className={changed ? "scope-change" : ""}>
                    <strong>{s.product_name}</strong>
                    <span>{s.brand || "No brand restriction"}</span>
                    {changed && (
                      <small>
                        {i === 0
                          ? "Removed from submission"
                          : "Added in submission"}
                      </small>
                    )}
                  </li>
                );
              }) || <li>No scope on file</li>}
            </ul>
          </section>
        ))}
      </div>
      <div className="renewal-columns renewal-photos">
        {[
          [current, "Current certificate image"],
          [renewal, "Submitted renewal image"],
        ].map(([record, title]) => (
          <section key={title}>
            <h3>{title}</h3>
            {record?.image ? (
              <PhotoViewer reference={record.image} title={title} alt={title} />
            ) : (
              <p className="image-absent">No image on file.</p>
            )}
          </section>
        ))}
      </div>
    </section>
  );
}
