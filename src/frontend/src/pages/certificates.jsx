import React, { useEffect, useRef, useState } from "react";
import { useSession, useDraft, organisationName } from "../lib/session.jsx";
import { useRecord, useScopedMutation } from "../lib/api/hooks.js";
import { ApiError } from "../lib/api/client.js";
import { preparedRenewal } from "../lib/preview/gateway.js";
import { formatDate } from "../lib/format.js";
import { Status } from "../components/status.jsx";
import { RequestState, ErrorMessage } from "../components/request-state.jsx";
import { ScopeEditor } from "../components/scope-editor.jsx";
import { PhotoViewer } from "../components/photo-viewer.jsx";
function CertificateRecord({ record }) {
  return (
    <article className="certificate-record">
      <div className="certificate-record-top">
        <h2>{record.cert_no}</h2>
        <Status value={record.status} />
      </div>
      <p>{record.issuer}</p>
      <dl className="certificate-details">
        <div>
          <dt>Holder</dt>
          <dd>{record.holder_name}</dd>
        </div>
        <div>
          <dt>Expiry</dt>
          <dd>{formatDate(record.expiry_date)}</dd>
        </div>
      </dl>
      <table aria-label={"Products in " + record.cert_no}>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Brand restriction</th>
          </tr>
        </thead>
        <tbody>
          {record.scope.map((r, index) => (
            <tr key={index}>
              <th scope="row">{r.product_name}</th>
              <td>{r.brand || "Any brand"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {record.review_note && (
        <div className="review-note">
          <strong>{record.reviewed_by || "Registry reviewer"}</strong>
          <p>{record.review_note}</p>
        </div>
      )}
      {record.renewal_requested_on && (
        <p className="capability-note">
          Renewal requested on {formatDate(record.renewal_requested_on)}.
        </p>
      )}
      {record.image && (
        <PhotoViewer
          reference={record.image}
          alt="Certificate image on file"
          title="Certificate image"
        />
      )}
    </article>
  );
}
function draftOf(current, holder = "") {
  return {
    issuer: current?.issuer || "",
    cert_no: current?.cert_no || "",
    holder_name: current?.holder_name || holder,
    expiry_date: current?.expiry_date || "",
    scope: (current?.scope || [{ product_name: "", brand: null }]).map((r) => ({
      ...r,
      brand: r.brand || "",
      row_id: crypto.randomUUID(),
    })),
  };
}
function RenewalForm({
  current,
  onSaved,
  onChanged,
  onConflict,
  pendingReview = false,
}) {
  const session = useSession();
  const [draft, setDraft] = useState(() =>
    draftOf(current, organisationName(session.identity)),
  );
  const [image, setImage] = useState(null);
  const [imageError, setImageError] = useState(null);
  const imageInput = useRef(null);
  const [validation, setValidation] = useState(null);
  const [dirty, setDirty] = useState(false);
  const summary = useRef(null);
  const mutation = useScopedMutation(
    (ctx, input) => session.gateway.renewCertificate(ctx, input),
    {
      onSuccess: onSaved,
      onError: (error) => {
        if (error.status === 409) onConflict?.();
      },
    },
  );
  useDraft(dirty || mutation.isPending);
  useEffect(() => {
    if (validation || mutation.error) summary.current?.focus();
  }, [validation, mutation.error]);
  function update(key, value) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
    onChanged?.();
    setValidation(null);
  }
  function usePrepared() {
    if (!session.confirmDiscard()) return;
    setDraft(draftOf(preparedRenewal(session.identity.tenant)));
    setImage(null);
    setImageError(null);
    if (imageInput.current) imageInput.current.value = "";
    setDirty(true);
    onChanged?.();
    setValidation(null);
    mutation.reset();
  }
  function chooseImage(file) {
    if (!file) return;
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setImage(null);
      setImageError("Choose a PNG or JPEG up to 10 MiB.");
      setValidation(
        new ApiError(422, "Choose a certificate PNG or JPEG up to 10 MiB.", {
          image: "Choose a PNG or JPEG up to 10 MiB.",
        }),
      );
      return;
    }
    setImage(file);
    setImageError(null);
    setDirty(true);
    onChanged?.();
    setValidation(null);
  }
  function submit(event) {
    event.preventDefault();
    const issues = {};
    if (imageError) issues.image = imageError;
    const input = {};
    for (const key of ["issuer", "cert_no", "holder_name", "expiry_date"]) {
      input[key] = draft[key].trim();
      if (!input[key]) issues[key] = "Complete this field.";
    }
    input.scope = draft.scope.map((r) => ({
      product_name: r.product_name.trim(),
      brand: r.brand.trim() || null,
    }));
    if (!input.scope.length)
      issues.scope = "Add at least one product covered by this certificate.";
    input.scope.forEach((r, index) => {
      if (!r.product_name)
        issues["scope." + index + ".product_name"] = "Enter the product name.";
    });
    if (Object.keys(issues).length) {
      setValidation(new ApiError(422, "Check the renewal fields.", issues));
      return;
    }
    setValidation(null);
    mutation.mutate({ ...input, image });
  }
  return (
    <section className="renewal-form-section">
      <h2>{current ? "Renew certificate" : "Add a certificate"}</h2>
      <p className="muted">
        Review the fields and keep every product and brand restriction you
        intend to cover.
      </p>
      {session.gateway.mode === "preview" && (
        <div className="prepared-renewal">
          <p>
            This preview can submit its prepared renewal. Other changes require
            the backend.
          </p>
          <button
            type="button"
            className="button quiet"
            disabled={mutation.isPending}
            onClick={usePrepared}
          >
            Use prepared renewal
          </button>
        </div>
      )}
      <form onSubmit={submit} noValidate className="renewal-form">
        <div ref={summary} tabIndex={-1}>
          {(validation || mutation.error) && (
            <ErrorMessage error={validation || mutation.error} />
          )}
        </div>
        <fieldset disabled={mutation.isPending} className="certificate-fields">
          {[
            ["issuer", "Issuer", "text", 200],
            ["cert_no", "Certificate number", "text", 100],
            ["holder_name", "Holder name", "text", 200],
            ["expiry_date", "Expiry date", "date", undefined],
          ].map(([key, title, type, maxLength]) => (
            <div className="field" key={key}>
              <label htmlFor={"renew-" + key}>{title}</label>
              <input
                id={"renew-" + key}
                type={type}
                required
                maxLength={maxLength}
                value={draft[key]}
                onChange={(e) => update(key, e.target.value)}
              />
            </div>
          ))}
        </fieldset>
        <ScopeEditor
          rows={draft.scope}
          onChange={(value) => update("scope", value)}
          disabled={mutation.isPending}
        />
        <div className="field certificate-image-input">
          <label htmlFor="certificate-image">
            Certificate image (optional)
          </label>
          <input
            id="certificate-image"
            ref={imageInput}
            type="file"
            accept="image/png,image/jpeg"
            disabled={mutation.isPending}
            onChange={(e) => chooseImage(e.target.files?.[0])}
          />
          <small>PNG or JPEG, up to 10 MiB.</small>
          {(image || imageError) && (
            <button
              type="button"
              className="button quiet"
              disabled={mutation.isPending}
              onClick={() => {
                setImage(null);
                setImageError(null);
                setValidation(null);
                setDirty(true);
                onChanged?.();
                if (imageInput.current) imageInput.current.value = "";
              }}
            >
              Remove image
            </button>
          )}
          {image && (
            <>
              <p>{image.name}</p>
              <PhotoViewer
                file={image}
                alt="Selected certificate image"
                title="Certificate image"
              />
            </>
          )}
        </div>
        <p className="renewal-submit-note">
          Your current certificate stays active while this renewal is reviewed.
        </p>
        <button
          className="button primary"
          disabled={mutation.isPending || pendingReview}
        >
          {mutation.isPending
            ? "Submitting renewal…"
            : "Submit renewal for review"}
        </button>
        {mutation.isPending && (
          <p role="status">Submitting for registry review…</p>
        )}
      </form>
    </section>
  );
}
export default function Certificates() {
  const session = useSession(),
    query = useRecord("listCertificates");
  const [saved, setSaved] = useState(null),
    [draftBase, setDraftBase] = useState(null),
    [hasDraft, setHasDraft] = useState(false);
  const receipt = useRef(null),
    records = query.data || [],
    current = records.find((c) => c.status === "active"),
    pending = records.find((c) => c.status === "pending");
  const receiptRecord = records.find((c) => c.id === saved?.id) || saved;
  useEffect(() => {
    if (saved) receipt.current?.focus();
  }, [saved]);
  function changed() {
    setHasDraft(true);
    setDraftBase((base) => base || current);
  }
  function refresh() {
    if (session.confirmDiscard()) query.refetch();
  }
  return (
    <div className="page certificates-page">
      <div className="page-intro">
        <h1>Your certificate records</h1>
        <p>
          One shared record. Renewals become active after a registry review.
        </p>
        <button
          type="button"
          className="button quiet refresh-records"
          onClick={refresh}
        >
          Refresh records
        </button>
      </div>
      <RequestState query={query} noun="certificates">
        <div className="registry-layout">
          <section aria-label="Certificate records">
            <h2>Current certificate</h2>
            {current ? (
              <CertificateRecord record={current} />
            ) : (
              <p className="muted">No active certificate is on file.</p>
            )}
            {records
              .filter((c) => c.status === "pending")
              .map((c) => (
                <section key={c.id} className="certificate-state-group">
                  <h2>Waiting for review</h2>
                  <CertificateRecord record={c} />
                </section>
              ))}
            {records
              .filter((c) => c.status === "rejected")
              .map((c) => (
                <section key={c.id} className="certificate-state-group">
                  <h2>Reviewed and rejected</h2>
                  <CertificateRecord record={c} />
                  {!pending && (
                    <button
                      type="button"
                      className="button quiet"
                      onClick={() => {
                        if (session.confirmDiscard()) {
                          setDraftBase(c);
                          setHasDraft(true);
                          setSaved(null);
                        }
                      }}
                    >
                      Prepare corrected renewal
                    </button>
                  )}
                </section>
              ))}
            <details className="certificate-history">
              <summary>
                Previous certificates (
                {records.filter((c) => c.status === "superseded").length})
              </summary>
              {records
                .filter((c) => c.status === "superseded")
                .map((c) => (
                  <CertificateRecord key={c.id} record={c} />
                ))}
            </details>
          </section>
          <section aria-label="Renewal submission">
            <div className="supplier-review-process">
              <span>Submit</span>
              <span>Registry review</span>
              <span>Active record</span>
            </div>
            {receiptRecord && (
              <section className="renewal-receipt" role="status">
                <h2 ref={receipt} tabIndex={-1}>
                  {receiptRecord.status === "pending"
                    ? "Renewal submitted."
                    : receiptRecord.status === "active"
                      ? "Renewal verified."
                      : "Renewal reviewed."}
                </h2>
                <p>{receiptRecord.cert_no}</p>
                <Status value={receiptRecord.status} />
                <p>
                  {receiptRecord.status === "pending"
                    ? "Your current certificate stays active while this renewal is reviewed."
                    : receiptRecord.review_note ||
                      "The latest registry state is shown in your records."}
                </p>
              </section>
            )}
            {pending && (
              <div className="pending-notice">
                <h2>A renewal is waiting for review.</h2>
                <p>
                  The active record stays in place until a reviewer verifies
                  this submission.
                </p>
                {hasDraft && (
                  <>
                    <p>
                      Your unsent draft is kept below. It cannot be submitted
                      while another renewal is pending.
                    </p>
                    <button
                      type="button"
                      className="button quiet"
                      onClick={() => {
                        if (session.confirmDiscard()) {
                          setHasDraft(false);
                          setDraftBase(null);
                        }
                      }}
                    >
                      Discard unsent draft
                    </button>
                  </>
                )}
              </div>
            )}
            {(!pending || hasDraft) &&
              !(saved && receiptRecord?.status === "pending") && (
                <RenewalForm
                  key={draftBase?.id || current?.id || "new"}
                  current={draftBase || current}
                  onChanged={changed}
                  pendingReview={!!pending}
                  onConflict={() => query.refetch()}
                  onSaved={(record) => {
                    setSaved(record);
                    setHasDraft(false);
                    setDraftBase(null);
                  }}
                />
              )}
          </section>
        </div>
      </RequestState>
    </div>
  );
}
