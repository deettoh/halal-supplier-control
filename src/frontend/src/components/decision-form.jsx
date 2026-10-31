import React, { useId, useState } from "react";
import { Info } from "lucide-react";
import { useDraft } from "../lib/session.jsx";
import { ErrorMessage } from "./request-state.jsx";
export function DecisionForm({
  delivery,
  onDecision,
  pending = false,
  error,
  blocked = false,
  canHold = false,
}) {
  const [decision, setDecision] = useState("");
  const [reason, setReason] = useState("");
  const [nextStep, setNextStep] = useState("");
  const id = useId();
  const resolved = !["pending_review", "on_hold"].includes(delivery.status);
  useDraft(!resolved && (!!decision || !!reason));
  const disabled =
    pending ||
    blocked ||
    !decision ||
    !reason.trim() ||
    (decision === "hold" && !nextStep);
  if (delivery.status === "auto_accepted")
    return (
      <section className="decision-panel">
        <h2>Automatically accepted</h2>
        <p>The recorded checks did not require a supervisor decision.</p>
        <p className="muted">
          The original coverage result remains on the delivery record.
        </p>
      </section>
    );
  function submit(event) {
    event.preventDefault();
    if (!disabled)
      onDecision({
        decision,
        reason: reason.trim(),
        ...(decision === "hold" ? { next_step: nextStep } : {}),
      });
  }
  return (
    <section className="decision-panel" aria-labelledby={id + "heading"}>
      <h2 id={id + "heading"}>Record a decision</h2>
      {resolved ? (
        <div className="decision-confirmation" role="status">
          <strong>Decision recorded</strong>
          <p>
            {delivery.status === "accepted" ? "Accepted" : "Rejected"} by{" "}
            {delivery.decided_by}.
          </p>
          <p>{delivery.reason}</p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <fieldset disabled={pending || blocked}>
            <legend className="sr-only">Decision</legend>
            {[
              "accept",
              "reject",
              ...(canHold && delivery.status === "pending_review"
                ? ["hold"]
                : []),
            ].map((value) => (
              <label className="decision-option" key={value}>
                <input
                  type="radio"
                  aria-label={
                    value === "hold"
                      ? "Hold delivery"
                      : value === "accept"
                        ? "Accept delivery"
                        : "Reject delivery"
                  }
                  name={id + "decision"}
                  value={value}
                  checked={decision === value}
                  onChange={() => setDecision(value)}
                />
                <span>
                  <strong>
                    {value === "hold"
                      ? "Hold delivery"
                      : value === "accept"
                        ? "Accept delivery"
                        : "Reject delivery"}
                  </strong>
                  <small>
                    {value === "hold"
                      ? "Record a reason and the next step."
                      : "Record " +
                        (value === "accept" ? "acceptance" : "rejection") +
                        " with a reason."}
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
          {delivery.status === "on_hold" && (
            <p className="hold-context" role="status">
              On hold:{" "}
              {delivery.next_step === "request_certificate"
                ? "Request current certificate"
                : "Request product details"}
              . Previous reason: {delivery.reason}
            </p>
          )}
          {decision === "hold" && (
            <div className="field hold-next">
              <label htmlFor={id + "next"}>Next step (required)</label>
              <select
                id={id + "next"}
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                disabled={pending || blocked}
              >
                <option value="">Choose a next step</option>
                <option value="request_certificate">
                  Request current certificate
                </option>
                <option value="request_product_details">
                  Request product details
                </option>
              </select>
            </div>
          )}
          <div className="decision-reason">
            <label htmlFor={id + "reason"}>Reason (required)</label>
            <textarea
              id={id + "reason"}
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={pending || blocked}
              placeholder="Explain your decision."
            />
          </div>
          <div className="decision-action">
            <button className="button primary" disabled={disabled}>
              {pending ? "Recording decision…" : "Record decision"}
            </button>
            <p className="decision-hint">
              <Info size={20} aria-hidden="true" />
              {blocked
                ? "Refresh the queue before deciding."
                : "Choose a decision and enter a reason."}
            </p>
            <p className="coverage-disclosure">
              Document coverage only.
              <br />
              No certification or authenticity ruling.
            </p>
          </div>
        </form>
      )}
      {error && <ErrorMessage error={error} />}
    </section>
  );
}
