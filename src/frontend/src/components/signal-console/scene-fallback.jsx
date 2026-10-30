import React from "react";
import { EvidencePlane } from "./panels.jsx";
export function SceneFallback({ selectedField, onSelect }) {
  return (
    <div className="sc-fallback">
      <div className="console-position">
        <div className="console-world">
          <div className="console-base" aria-hidden="true" />
          <div className="console-shell" aria-hidden="true" />
          <div className="console-head">
            <span className="console-title">
              <span className="status-dot" />
              Delivery evidence
            </span>
            <span className="sample-label">ILLUSTRATIVE SAMPLE</span>
          </div>
          {["source", "reading", "rules"].map((kind) => (
            <EvidencePlane
              key={kind}
              kind={kind}
              selectedField={selectedField}
              onSelect={onSelect}
            />
          ))}
          <div className="console-foot">
            <span>
              Photo <i /> Reading <i /> Checks <i /> Human review
            </span>
            <span>Document coverage only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
