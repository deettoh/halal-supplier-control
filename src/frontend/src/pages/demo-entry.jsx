import React, { useState } from "react";
import { useLocation } from "wouter";
import { AppLink as Link } from "../lib/navigation.jsx";
import { transitionUpdate } from "../lib/motion.js";
import { ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useSession,
  organisations,
  validateIdentity,
  homeForRole,
} from "../lib/session.jsx";

export default function DemoEntry({ requestedPath }) {
  const session = useSession();
  const client = useQueryClient();
  const [resetMessage, setResetMessage] = useState("");
  async function resetPreview() {
    if (!session.confirmDiscard()) return;
    await session.gateway.resetPreview();
    await client.invalidateQueries();
    setResetMessage("Prepared examples reset.");
  }
  const [, navigate] = useLocation();
  const [role, setRole] = useState(session.identity?.role || "");
  const [tenant, setTenant] = useState(session.identity?.tenant || "");
  const options = role
    ? organisations[role === "supplier" ? "supplier" : "sme"]
    : [];
  const valid = validateIdentity({ role, tenant });
  function submit(event) {
    event.preventDefault();
    if (valid) {
      const destinations =
        role === "supplier"
          ? ["/certificates"]
          : role === "staff"
            ? ["/check", "/masterlist"]
            : ["/review", "/masterlist", "/activity"];
      transitionUpdate(() => {
        session.selectIdentity(valid);
        navigate(
          destinations.includes(requestedPath)
            ? requestedPath
            : homeForRole(role),
        );
      });
    }
  }
  return (
    <>
      <header className="public-header">
        <Link href="/" className="wordmark">
          Halal
          <br />
          Supplier Control
        </Link>
        <Link href="/">Back to introduction</Link>
      </header>
      <main className="entry-page route-arrival">
        <div className="entry-intro">
          <h1>A workspace for your part of the process.</h1>
          <p>
            Check a delivery, review an exception, or renew the record buyers
            rely on.
          </p>
          <p className="muted">
            SAMPLE data. Document coverage only; no independent
            certificate-authenticity decision or religious ruling.
          </p>
        </div>
        <form className="entry-form" onSubmit={submit}>
          <fieldset>
            <legend>Choose your role</legend>
            {[
              ["staff", "Receiving staff", "Check a delivery label"],
              ["supervisor", "Halal supervisor", "Review flagged deliveries"],
              ["supplier", "Supplier", "Renew certificate records"],
            ].map(([value, title, task]) => (
              <label
                className="role-option"
                htmlFor={"role-" + value}
                key={value}
              >
                <input
                  id={"role-" + value}
                  type="radio"
                  name="role"
                  value={value}
                  checked={role === value}
                  onChange={() => {
                    setRole(value);
                    setTenant("");
                  }}
                />
                <span>
                  <strong>{title}</strong>
                  <small>{task}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="organisation">Organisation</label>
            <select
              id="organisation"
              value={tenant}
              onChange={(e) => setTenant(e.target.value)}
              disabled={!role}
            >
              <option value="">Choose an organisation</option>
              {options.map((o) => (
                <option key={o.tenant} value={o.tenant}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <button className="button primary" disabled={!valid}>
            Enter workspace
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <p className="entry-note">
            Sample workspaces. Roles are simulated for this demonstration.
          </p>
          {session.gateway.mode === "preview" && (
            <div className="entry-preview">
              <p className="entry-note">
                Prepared preview: scripted examples in this tab. No model calls
                or database saves.
              </p>
              <button
                type="button"
                className="button quiet"
                onClick={resetPreview}
              >
                Reset prepared examples
              </button>
              <p className="entry-note">
                Resets prepared deliveries, decisions and renewals in this tab.
              </p>
              {resetMessage && <p role="status">{resetMessage}</p>}
            </div>
          )}
        </form>
      </main>
    </>
  );
}
