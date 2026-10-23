import React from "react";
import { AppLink as Link } from "../lib/navigation.jsx";
import { ArrowRight, FileText, Store } from "lucide-react";
import { LandingEvidence } from "../components/landing-evidence.jsx";
import { useIllustrationMotion } from "../lib/illustration-motion.js";
import { OpeningIntro } from "../components/opening-intro.jsx";
export default function Landing() {
  return (
    <OpeningIntro>
      <LandingContent />
    </OpeningIntro>
  );
}

function LandingContent() {
  const renewalRef = useIllustrationMotion();
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
      <main className="route-arrival">
        <section className="landing-hero">
          <div className="landing-intro">
            <h1>Know what your documents cover.</h1>
            <p>
              Check delivery labels against supplier records. Review exceptions
              with evidence.
            </p>
            <Link href="/demo" className="button primary hero-cta">
              Enter demo
              <ArrowRight size={24} aria-hidden="true" />
            </Link>
          </div>
          <LandingEvidence />
        </section>
        <section
          className="how-it-works"
          id="how-it-works"
          aria-labelledby="workflow-heading"
        >
          <h2 id="workflow-heading">How it works</h2>
          <ol>
            <li>
              <span aria-hidden="true">1</span>
              <div>
                <h3>Photograph</h3>
                <p>Receiving staff</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">2</span>
              <div>
                <h3>Check records</h3>
                <p>Model reads · rules check</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">3</span>
              <div>
                <h3>Review exceptions</h3>
                <p>Supervisor decides</p>
              </div>
            </li>
          </ol>
        </section>
        <section className="shared-renewal" aria-labelledby="renewal-heading">
          <div className="renewal-intro">
            <h2 id="renewal-heading">Renew once. Update linked buyers.</h2>
          </div>
          <div className="renewal-network" ref={renewalRef}>
            <div className="registry-record">
              <FileText size={34} aria-hidden="true" />
              <div>
                <h3>Silver Valley Ingredients SAMPLE</h3>
                <p>SAMPLE-SVI-2026-001</p>
                <small>Shared supplier record</small>
              </div>
            </div>
            <svg
              className="renewal-connector"
              viewBox="0 0 80 100"
              fill="none"
              aria-hidden="true"
            >
              <path className="connector-base" d="M0 50H30V24H80M30 50V76H80" />
              <path
                className="connector-trace"
                pathLength="1"
                d="M0 50H30V24H80"
              />
              <path
                className="connector-trace"
                pathLength="1"
                d="M30 50V76H80"
              />
            </svg>
            <svg
              className="renewal-connector renewal-connector-phone"
              viewBox="0 0 32 32"
              fill="none"
              aria-hidden="true"
            >
              <path className="connector-base" d="M16 0V30M10 24L16 30L22 24" />
              <path
                className="connector-trace"
                pathLength="1"
                d="M16 0V30M10 24L16 30L22 24"
              />
            </svg>
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
