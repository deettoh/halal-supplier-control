import React, { useRef, useState } from "react";
import { ArrowRight, ArrowUp, FileCheck2, Building2 } from "lucide-react";
import { AppLink } from "../lib/navigation.jsx";
import { OpeningIntro } from "../components/opening-intro.jsx";
import LandingScene from "../components/signal-console/index.jsx";
import { transitionUpdate } from "../lib/motion.js";
import { LoupeBrand } from "../components/loupe-brand.jsx";
export default function Landing() {
  const [approved, setApproved] = useState(false);
  const scene = useRef();
  const intro = useRef();
  function jump(event, id) {
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    transitionUpdate(() => {
      scene.current?.jumpToSection(target);
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
      history.replaceState(null, "", "#" + id);
    });
  }
  return (
    <OpeningIntro apiRef={intro}>
      <div className="signal-landing">
        <a
          className="skip-link"
          href="#registry"
          onClick={(e) => jump(e, "registry")}
        >
          Skip the animated walkthrough
        </a>
        <header className="site-header">
          <AppLink className="brand" href="/" aria-label="Loupe">
            <LoupeBrand />
          </AppLink>
          <nav aria-label="Main navigation">
            <a href="#walkthrough" onClick={(e) => jump(e, "walkthrough")}>
              How it works
            </a>
            <a href="#registry" onClick={(e) => jump(e, "registry")}>
              Shared registry
            </a>
          </nav>
          <AppLink className="header-cta" href="/demo">
            Enter demo <ArrowRight aria-hidden="true" />
          </AppLink>
        </header>
        <main>
          <LandingScene apiRef={scene} />
          <section
            className="registry-section"
            id="registry"
            aria-labelledby="registry-title"
          >
            <div className="registry-copy">
              <h2 id="registry-title">
                One approved renewal.
                <br />
                <span>
                  Shared across
                  <br />
                  linked buyers.
                </span>
              </h2>
              <p>
                The supplier submits. A registry reviewer checks.
                <br />
                Each buyer sees the current shared record.
              </p>
              <button
                className="primary"
                type="button"
                onClick={() => setApproved((v) => !v)}
              >
                {approved ? "Reset illustration" : "Preview approval"}{" "}
                <ArrowRight aria-hidden="true" />
              </button>
              <p className="quiet-note">
                Illustration only. Coverage still depends on each
                <br />
                material's scope and the buyer's settings.
              </p>
            </div>
            <div className={"registry-network " + (approved ? "approved" : "")}>
              <div className="network-entry">
                <FileCheck2 className="document-icon" aria-hidden="true" />
                <div>
                  <span>Golden Grain Supplies SAMPLE</span>
                  <strong>
                    {approved ? "New record is active" : "Renewal submitted"}
                  </strong>
                  <span className="network-status">
                    {approved
                      ? "Verified in this illustration"
                      : "Waiting for review"}
                  </span>
                </div>
              </div>
              <div className="network-reviewer">
                <span className="avatar" aria-hidden="true">
                  N
                </span>
                <div>
                  <strong>Nadia</strong>
                  <span>Registry reviewer</span>
                </div>
                <span className="reviewer-mark">
                  {approved ? "Reviewed with a note" : "Review required"}
                </span>
              </div>
              <div className="network-lines" aria-hidden="true">
                <span className="line-stem" />
                <span className="line-branch branch-left" />
                <span className="line-branch branch-right" />
              </div>
              <div className="network-buyers">
                {["Sunrise Bakery", "Crescent Caterer"].map((name) => (
                  <div key={name}>
                    <Building2 aria-hidden="true" />
                    <strong>
                      {name}
                      <small>SAMPLE</small>
                    </strong>
                    <span className="buyer-status">
                      {approved
                        ? "Shared record updated"
                        : "Current record unchanged"}
                    </span>
                  </div>
                ))}
              </div>
              <p className="network-note" aria-live="polite">
                {approved
                  ? "One reviewed renewal. Both linked buyers read the current record."
                  : "Pending renewals leave the active record in place."}
              </p>
            </div>
          </section>
          <section className="roles-section" aria-labelledby="roles-title">
            <div className="roles-lead">
              <h2 id="roles-title">
                The same evidence.
                <br />A clear role for everyone.
              </h2>
              <p>
                From the receiving door to the shared registry, each person has
                a clear next step.
              </p>
              <AppLink className="primary roles-cta" href="/demo">
                Enter demo <ArrowRight aria-hidden="true" />
              </AppLink>
            </div>
            <div className="role-list">
              {[
                ["Receiving staff", "Photograph the delivery label"],
                ["Halal supervisor", "Review exceptions with a reason"],
                ["Supplier contact", "Submit a certificate renewal"],
                ["Registry reviewer", "Review the renewal before it is active"],
              ].map(([name, task]) => (
                <AppLink className="role-explainer" href="/demo" key={name}>
                  <strong>{name}</strong>
                  <span>{task}</span>
                  <ArrowRight aria-hidden="true" />
                </AppLink>
              ))}
            </div>
          </section>
        </main>
        <footer className="site-footer">
          <span>Loupe</span>
          <p>
            SAMPLE demonstration. Document coverage only.
            <br />
            Not a religious ruling or independent certificate-authenticity
            decision.
          </p>
          <div className="footer-actions">
            <button
              className="intro-replay"
              type="button"
              onClick={() => {
                if (intro.current?.replay())
                  scene.current?.jumpToSection(
                    document.getElementById("walkthrough"),
                  );
              }}
            >
              Replay intro
            </button>
            <a href="#walkthrough" onClick={(e) => jump(e, "walkthrough")}>
              Back to the evidence <ArrowUp aria-hidden="true" />
            </a>
          </div>
        </footer>
      </div>
    </OpeningIntro>
  );
}
