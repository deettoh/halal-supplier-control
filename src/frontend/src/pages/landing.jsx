import React from "react";
import { Link } from "wouter";
import { ArrowRight, ArrowDown, FileText, Store } from "lucide-react";
import { Status } from "../components/status.jsx";
export default function Landing() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Link href="/" className="landing-brand">
          Halal Supplier Control
        </Link>
        <nav aria-label="Introduction">
          <a href="#how-it-works">How it works</a>
          <Link href="/demo" className="button primary">
            Enter demo
          </Link>
        </nav>
      </header>
      <main>
        <section className="landing-hero">
          <div className="landing-intro">
            <h1>Know what your documents cover.</h1>
            <p>
              Compare delivery labels with your masterlist and supplier records.
              Flagged deliveries go to your supervisor.
            </p>
            <Link href="/demo" className="button primary hero-cta">
              Enter demo
              <ArrowRight size={24} aria-hidden="true" />
            </Link>
          </div>
          <figure className="landing-evidence">
            <div className="landing-photo">
              <h2>Label photo</h2>
              <img
                src="/media/label-alt-brand.png"
                width="1246"
                height="1262"
                alt="Fictional cocoa package. ALT SAMPLE BRAND, Cocoa Powder, manufactured by Silver Valley Foods."
              />
            </div>
            <div className="landing-reading">
              <h2>Read from label</h2>
              <dl>
                <div>
                  <dt>Product</dt>
                  <dd>Cocoa Powder</dd>
                </div>
                <div>
                  <dt>Brand</dt>
                  <dd>ALT SAMPLE BRAND</dd>
                </div>
                <div>
                  <dt>Manufacturer</dt>
                  <dd>Silver Valley Foods</dd>
                </div>
              </dl>
              <div className="landing-exception">
                <Status value="substitution" />
                <h3>Needs supervisor review</h3>
                <p>Brand differs from approved SilverCocoa.</p>
              </div>
            </div>
            <figcaption>
              Illustrative workflow · SAMPLE data · Prepared example dated 22
              Oct 2026.
            </figcaption>
          </figure>
        </section>
        <section className="shared-renewal">
          <div className="renewal-intro">
            <h2>One renewal. Updated coverage for linked buyers.</h2>
            <p>
              Suppliers maintain one shared record. Each buyer's masterlist uses
              its product and brand scope.
            </p>
          </div>
          <div className="renewal-network">
            <div className="registry-record">
              <FileText size={34} aria-hidden="true" />
              <div>
                <h3>Silver Valley Ingredients SAMPLE</h3>
                <p>SAMPLE-SVI-2026-001</p>
                <small>Shared supplier record</small>
              </div>
            </div>
            <ArrowRight
              className="network-arrow"
              size={32}
              aria-hidden="true"
            />
            <ul>
              {["Sunrise Bakery SAMPLE", "Crescent Caterer SAMPLE"].map(
                (name) => (
                  <li key={name}>
                    <Store size={25} aria-hidden="true" />
                    <span>{name}</span>
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>
        <section className="how-it-works" id="how-it-works">
          <div>
            <h2>
              Evidence in.
              <br />A decision on record.
            </h2>
            <p>
              The model reads the label. Rules check the records. Your
              supervisor decides exceptions.
            </p>
            <ArrowDown size={28} aria-hidden="true" />
          </div>
          <ol>
            <li>
              <span>1</span>
              <div>
                <h3>Record what arrived</h3>
                <p>
                  Receiving staff choose the approved material and photograph
                  the delivered label.
                </p>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <h3>Compare it with the documents</h3>
                <p>
                  Five deterministic checks examine readability, approved
                  identity, certificate scope, expiry and the demo issuer list.
                </p>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <h3>Keep the human decision</h3>
                <p>
                  Supervisors inspect flagged deliveries and record acceptance
                  or rejection with a reason.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className="landing-close">
          <h2>Try your part of the process.</h2>
          <Link href="/demo" className="button primary">
            Enter demo
            <ArrowRight size={22} aria-hidden="true" />
          </Link>
        </section>
      </main>
      <footer>
        <strong>Halal Supplier Control</strong>
        <p>
          SAMPLE data. Document coverage only; no independent
          certificate-authenticity decision or religious ruling.
        </p>
      </footer>
    </div>
  );
}
