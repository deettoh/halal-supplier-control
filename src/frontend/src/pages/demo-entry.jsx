import React, { useState } from "react";

import { useLocation } from "wouter";

import { AppLink } from "../lib/navigation.jsx";

import { transitionUpdate } from "../lib/motion.js";
import { LoupeBrand } from "../components/loupe-brand.jsx";

import { ArrowRight, RefreshCw } from "lucide-react";

import { useQueryClient } from "@tanstack/react-query";

import {
  useSession,
  organisationName,
  routesForRole,
  homeForRole,
} from "../lib/session.jsx";

export default function DemoEntry({ requestedPath }) {
  const session = useSession(),
    client = useQueryClient(),
    [, navigate] = useLocation();

  const [selected, setSelected] = useState(session.identity?.person_id || null);

  const [resetMessage, setResetMessage] = useState("");

  const people = session.people.data;

  const person = people.find((p) => p.id === selected);

  async function resetPreview() {
    if (!session.confirmDiscard()) return;

    await session.gateway.resetPreview();
    await client.invalidateQueries();

    setResetMessage("Prepared examples reset.");
  }

  function submit(event) {
    event.preventDefault();
    if (!person || !session.confirmDiscard()) return;

    transitionUpdate(() => {
      session.selectIdentity(person);
      navigate(
        routesForRole[person.role].includes(requestedPath)
          ? requestedPath
          : homeForRole(person.role),
      );
    });
  }

  return (
    <>
      <header className="public-header">
        <AppLink className="wordmark" href="/">
          <LoupeBrand />
        </AppLink>
        <AppLink href="/">Back to introduction</AppLink>
      </header>

      <main className="entry-page route-arrival">
        <div className="entry-intro">
          <h1>
            Choose your
            <br />
            workspace
          </h1>
          <p>
            Pick a SAMPLE person. Their role and organisation come with them.
          </p>
          <p className="muted">
            The same evidence. A clear next step for everyone involved.
          </p>
          <div className="entry-process">
            <span>Read the label</span>
            <span>Check the documents</span>
            <span>Keep the decision traceable</span>
          </div>
        </div>

        <form className="entry-form named-entry" onSubmit={submit}>
          {session.people.status === "loading" && (
            <p role="status">Loading demo people…</p>
          )}

          {session.people.status === "error" && (
            <div className="request-error" role="alert">
              <h2>Demo people are unavailable</h2>
              <p>
                {session.people.error?.status === 404
                  ? "The connected backend has not added named demo entry yet. Use the prepared preview to review the design, or retry after the team updates it."
                  : session.people.error?.message}
              </p>
              <button
                type="button"
                className="button"
                onClick={session.people.retry}
              >
                Retry
              </button>
            </div>
          )}

          {session.people.status === "success" && !people.length && (
            <p>No demo people are available. Ask the team to reset the demo.</p>
          )}

          <fieldset>
            <legend className="sr-only">Choose a demo person</legend>
            {people.map((p) => (
              <label
                className={
                  "person-option " + (selected === p.id ? "chosen" : "")
                }
                key={p.id}
              >
                <input
                  type="radio"
                  name="person"
                  checked={selected === p.id}
                  onChange={() => setSelected(p.id)}
                />
                <span className="person-avatar" aria-hidden="true">
                  {p.name[0]}
                </span>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {p.title} · {organisationName(p)}
                  </small>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </label>
            ))}
          </fieldset>

          <button className="button primary" disabled={!person}>
            Enter workspace <ArrowRight size={18} aria-hidden="true" />
          </button>
          <p className="entry-note">
            Demo identities. SAMPLE data. Document coverage only.
          </p>

          {session.gateway.mode === "preview" && (
            <div className="entry-preview">
              <p className="entry-note">
                Prepared preview: examples in this tab. No model calls or
                database saves.
              </p>
              <button
                type="button"
                className="button quiet"
                onClick={resetPreview}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Reset prepared examples
              </button>
              {resetMessage && <p role="status">{resetMessage}</p>}
            </div>
          )}
        </form>
      </main>
    </>
  );
}
