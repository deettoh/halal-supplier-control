import React from "react";
import { Camera, FileText, ListChecks, ChevronRight } from "lucide-react";
import data from "../../lib/preview/data.json";
export const sampleCase = data.cases.find((c) => c.id === "alt-manufacturer");
export const sampleDelivery = sampleCase.responses["9"];
const material = data.source_materials["9"];
const fields = {
  product: ["Product", "product_name", material.name],
  brand: ["Brand", "brand", material.approved_brand],
  manufacturer: [
    "Manufacturer",
    "manufacturer",
    material.approved_manufacturer,
  ],
};
const ruleNames = {
  R1: "Readable label",
  R2: "Product, brand & manufacturer",
  R3: "Certificate scope",
  R4: "Certificate expiry",
  R5: "Recognised issuer",
  R6: "Halal mark on label",
};
export function EvidencePlane({
  kind,
  selectedField = "brand",
  onSelect = () => {},
  selectedRule = "R2",
  onSelectRule = () => {},
  inCanvas = false,
}) {
  const Icon =
    kind === "source" ? Camera : kind === "reading" ? FileText : ListChecks;
  const title =
    kind === "source"
      ? "The photo"
      : kind === "reading"
        ? "The reading"
        : "The checks";
  const selected = fields[selectedField];
  const check =
    sampleDelivery.rule_results.find((r) => r.rule === selectedRule) ??
    sampleDelivery.rule_results[1];
  return (
    <article
      data-kind={kind}
      className={
        "evidence-plane " + kind + "-plane" + (inCanvas ? " sc-in-canvas" : "")
      }
    >
      <div className="plane-title">
        <Icon aria-hidden="true" />
        <h3>{title}</h3>
        <span className="plane-index">
          {kind === "source"
            ? "Source"
            : kind === "reading"
              ? "Model"
              : "Rules"}
          {kind === "rules" && (
            <span className="rule-result">Substitution</span>
          )}
        </span>
      </div>
      {kind === "source" ? (
        <>
          <div className="photo-well">
            <img
              src={sampleCase.image}
              width="788"
              height="1400"
              alt="Fictional SAMPLE flour label, GoldenMill Wheat Flour, manufactured by Meadow Forge Foods"
            />
            <div className="scan-strip" aria-hidden="true" />
          </div>
          <div className="photo-caption">
            <span>Wheat Flour</span>
            <span>Label photo</span>
          </div>
        </>
      ) : kind === "reading" ? (
        <>
          <p className="plane-description">What the label says</p>
          <div
            className="field-list"
            role="group"
            aria-label="Compare a label field"
          >
            {Object.entries(fields).map(([key, [name, field]]) => (
              <button
                key={key}
                type="button"
                className={
                  "field-row " + (key === selectedField ? "selected" : "")
                }
                aria-pressed={key === selectedField}
                onClick={() => onSelect(key)}
              >
                <span>{name}</span>
                <strong>{sampleDelivery.extracted[field]}</strong>
                <ChevronRight aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="comparison" aria-live="polite">
            <span>Approved {selected[0].toLowerCase()}</span>
            <strong>{selected[2]}</strong>
            <p>
              {selectedField === "manufacturer"
                ? "A different manufacturer needs a supervisor's review."
                : selectedField === "product"
                  ? "The product name matches the approved material."
                  : "The brand matches. The manufacturer still differs."}
            </p>
          </div>
        </>
      ) : (
        <>
          <ol className="rule-list">
            {sampleDelivery.rule_results.map((rule) => (
              <li key={rule.rule}>
                <button
                  type="button"
                  className={
                    "rule-row " +
                    (rule.rule === check.rule ? "rule-highlight" : "")
                  }
                  aria-pressed={rule.rule === check.rule}
                  aria-label={`${rule.rule} ${ruleNames[rule.rule]} ${rule.passed === true ? "Pass" : rule.passed === false ? "Review" : "Not read"}`}
                  onClick={() => onSelectRule(rule.rule)}
                >
                  <span className="rule-id">{rule.rule}</span>
                  <span>{ruleNames[rule.rule]}</span>
                  <span
                    className={
                      "rule-state " + (rule.passed === true ? "pass" : "review")
                    }
                  >
                    {rule.passed === true
                      ? "Pass"
                      : rule.passed === false
                        ? "Review"
                        : "Not read"}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div
            className="rule-detail"
            role="status"
            aria-label="Selected check reason"
          >
            <strong>
              {check.rule} · {ruleNames[check.rule]}
            </strong>
            <p>{check.detail}</p>
          </div>
        </>
      )}
    </article>
  );
}
