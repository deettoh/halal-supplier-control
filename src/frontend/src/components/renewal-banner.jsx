import React, { useId } from "react";
import { Clock, TriangleAlert } from "lucide-react";

import { formatDate } from "../lib/format.js";
import { daysLeftText, daysUntil } from "../lib/renewal.js";
import { Status } from "./status.jsx";
function urgentHeading(certificates, today) {
  const isSingle = certificates.length === 1;
  const allExpired = certificates.every(
    (c) => daysUntil(c.expiry_date, today) < 0,
  );
  const count =
    certificates.length + (isSingle ? " certificate " : " certificates ");
  if (allExpired) return count + (isSingle ? "has expired" : "have expired");
  return count + (isSingle ? "needs renewing" : "need renewing");
}
function urgentInstruction(certificates, today) {
  const isSingle = certificates.length === 1;
  const action = isSingle
    ? "Submit your new certificate for review"
    : "Submit a new certificate for review for each one";
  if (certificates.some((c) => daysUntil(c.expiry_date, today) < 0))
    return action + " as soon as you can.";
  return isSingle
    ? "It is still valid. " + action + " before it expires."
    : "They are still valid. " + action + " before they expire.";
}
function CertificateRow({ record, today, children }) {
  return (
    <li className="renewal-banner-row">
      <div>
        <strong>{record.cert_no}</strong>
        <span>Expiry date: {formatDate(record.expiry_date)}</span>
        <strong className="renewal-days">
          {daysLeftText(daysUntil(record.expiry_date, today))}
        </strong>
      </div>
      {children}
    </li>
  );
}
export function RenewalBanner({ state, today, onStart }) {
  const headingId = useId();
  const isUrgent = state.kind === "urgent";
  const Icon = isUrgent ? TriangleAlert : Clock;
  return (
    <section
      className={
        "renewal-banner " + (isUrgent ? "renewal-urgent" : "renewal-waiting")
      }
      aria-labelledby={headingId}
    >
      <Icon className="renewal-banner-icon" aria-hidden="true" />
      <div className="renewal-banner-body">
        <h2 id={headingId}>
          {isUrgent
            ? urgentHeading(state.certificates, today)
            : "Your renewal is waiting for review"}
        </h2>
        <p>
          {isUrgent
            ? urgentInstruction(state.certificates, today)
            : "You don't need to do anything else for now."}
        </p>
        {state.rejected && (
          <p>
            Your last renewal was rejected. Read the reviewer's note, then
            submit it again.
          </p>
        )}
        <ul>
          {state.certificates.map((record) => (
            <CertificateRow key={record.id} record={record} today={today}>
              {isUrgent && (
                <button
                  type="button"
                  className="button primary"
                  aria-label={"Start renewal for " + record.cert_no}
                  onClick={() => onStart(record)}
                >
                  Start renewal
                </button>
              )}
            </CertificateRow>
          ))}
        </ul>
      </div>
    </section>
  );
}
export function CertificateRenewalState({ kind, record, today }) {
  if (kind === "waiting")
    return (
      <p className="certificate-renewal-state renewal-waiting">
        <Clock size={18} aria-hidden="true" />
        Renewal submitted and waiting for review.
      </p>
    );
  return (
    <div className="certificate-renewal-state renewal-urgent">
      <TriangleAlert size={22} aria-hidden="true" />
      <div>
        <Status value="expiring">Needs renewing</Status>
        <p>
          <strong>{daysLeftText(daysUntil(record.expiry_date, today))}</strong>
        </p>
        <p>Renewal requested on {formatDate(record.renewal_requested_on)}.</p>
      </div>
    </div>
  );
}
