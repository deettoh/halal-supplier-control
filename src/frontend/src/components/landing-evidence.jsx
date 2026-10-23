import React, { useState } from "react";
import { Camera, FileText, ArrowLeftRight } from "lucide-react";
import { useIllustrationMotion } from "../lib/illustration-motion.js";
import { Status } from "./status.jsx";

export function LandingEvidence() {
  const ref = useIllustrationMotion();
  const [sheet, setSheet] = useState("compare");
  function inspect(value) {
    setSheet(value);
    if (window.matchMedia?.("(max-width: 600px)").matches) {
      ref.current
        ?.querySelector(
          ".landing-" + (value === "compare" ? "comparison" : value),
        )
        ?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
          block: "start",
        });
    }
  }
  return (
    <figure className="landing-evidence" ref={ref}>
      <div className="evidence-assembly" data-sheet={sheet}>
        <section
          className="evidence-sheet landing-photo"
          aria-labelledby="example-photo"
        >
          <h2 id="example-photo">Delivery label photo</h2>
          <div className="landing-photo-frame">
            <img
              src="/media/label-alt-brand.jpg"
              width="1246"
              height="1262"
              alt="Fictional cocoa package. ALT SAMPLE BRAND, Cocoa Powder, manufactured by Silver Valley Foods."
            />
          </div>
          <p className="sheet-footnote">SAMPLE · Fictional delivery label</p>
        </section>
        <section
          className="evidence-sheet landing-record"
          aria-labelledby="example-record"
        >
          <span className="record-index" aria-hidden="true">
            Supplier record
          </span>
          <h2 id="example-record">Supplier record</h2>
          <dl>
            <div>
              <dt>Product</dt>
              <dd>Cocoa Powder</dd>
            </div>
            <div>
              <dt>Approved brand</dt>
              <dd>SilverCocoa</dd>
            </div>
            <div>
              <dt>Manufacturer</dt>
              <dd>Silver Valley Foods</dd>
            </div>
            <div>
              <dt>Certificate number</dt>
              <dd>SAMPLE-SVI-2026-001</dd>
            </div>
          </dl>
        </section>
        <section
          className="evidence-sheet landing-comparison"
          aria-labelledby="example-comparison"
        >
          <h2 id="example-comparison">Label vs record</h2>
          <dl className="example-brand-pair">
            <div>
              <dt>Brand on record</dt>
              <dd>SilverCocoa</dd>
            </div>
            <div>
              <dt>Brand on label</dt>
              <dd>ALT SAMPLE BRAND</dd>
            </div>
          </dl>
          <div className="landing-exception">
            <Status value="substitution" />
            <h3>Needs supervisor review</h3>
            <p>Brand differs from approved SilverCocoa.</p>
          </div>
        </section>
      </div>
      <div
        className="evidence-controls"
        role="group"
        aria-label="Inspect the illustrative evidence"
      >
        {[
          ["photo", "Photo", Camera],
          ["record", "Record", FileText],
          ["compare", "Compare", ArrowLeftRight],
        ].map(([value, title, Icon]) => (
          <button
            key={value}
            type="button"
            aria-pressed={sheet === value}
            onClick={() => inspect(value)}
          >
            <Icon size={16} aria-hidden="true" />
            {title}
          </button>
        ))}
      </div>
      <figcaption>
        Illustrative workflow · SAMPLE data · Prepared example dated 22 Oct
        2026.
      </figcaption>
    </figure>
  );
}
