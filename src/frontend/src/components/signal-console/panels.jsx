import React from "react";
import {
  Camera,
  FileText,
  ListChecks,
  ChevronRight,
  CircleAlert,
} from "lucide-react";
import data from "../../lib/preview/data.json";
export const sampleCase = data.cases.find((c) => c.id === "alt-brand");
export const sampleDelivery = sampleCase.responses["6"];
const material = data.source_materials["6"];
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
        </span>
      </div>
      {kind === "source" ? (
        <>
          <div className="photo-well">
            <img
              src={sampleCase.image}
              width="1246"
              height="1262"
              alt="Fictional SAMPLE cocoa label, ALT SAMPLE BRAND, Silver Valley Foods"
            />
            <div className="scan-strip" aria-hidden="true" />
          </div>
          <div className="photo-caption">
            <span>Cocoa Powder</span>
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
              {selectedField === "brand"
                ? "A different brand needs a supervisor's review."
                : selectedField === "product"
                  ? "The product name matches the approved material."
                  : "The manufacturer matches. The brand still differs."}
            </p>
          </div>
          <div className="reading-foot">
            <span className="small-dot" />
            Prepared example. No live model call.
          </div>
        </>
      ) : (
        <>
          <ol className="rule-list">
            {sampleDelivery.rule_results.map((rule) => (
              <li
                key={rule.rule}
                className={rule.rule === "R2" ? "rule-highlight" : ""}
                title={rule.detail}
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
              </li>
            ))}
          </ol>
          <div className="rule-outcome">
            <span className="outline-dot" />
            <div>
              <strong>Substitution</strong>
              <span>First issue: the brand differs.</span>
            </div>
            <CircleAlert aria-hidden="true" />
          </div>
          <p className="rule-footnote">
            Illustrative SAMPLE journey.
            <br />
            Checks prepared with the production rules.
          </p>
        </>
      )}
    </article>
  );
}
