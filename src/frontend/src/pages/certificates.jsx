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
        <Status value={record.status}>
          {record.status === "active" ? "Active" : "Superseded"}
        </Status>
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
function RenewalForm({ current, onSaved }) {
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
    { onSuccess: onSaved },
  );
  useDraft(dirty || mutation.isPending);
  useEffect(() => {
    if (validation || mutation.error) summary.current?.focus();
  }, [validation, mutation.error]);
  function update(key, value) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
    setValidation(null);
  }
  function usePrepared() {
    if (!session.confirmDiscard()) return;
    setDraft(draftOf(preparedRenewal(session.identity.tenant)));
    setImage(null);
    setImageError(null);
    if (imageInput.current) imageInput.current.value = "";
    setDirty(true);
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
            This preview can publish its prepared renewal. Other changes require
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
          The new record replaces the active version. Linked masterlists use it
          when coverage is recalculated.
        </p>
        <button className="button primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Publishing renewal…" : "Publish renewal"}
        </button>
        {mutation.isPending && (
          <p role="status">Publishing the new certificate record…</p>
        )}
      </form>
    </section>
  );
}
export default function Certificates() {
  const query = useRecord("listCertificates");
  const [saved, setSaved] = useState(null);
  const success = useRef(null);
  const records = query.data || [];
  const current = records.find((c) => c.status === "active");
  const previous = records.filter((c) => c.status === "superseded");
  useEffect(() => {
    if (saved) success.current?.focus();
  }, [saved]);
  return (
    <div className="page certificates-page">
      <div className="page-intro">
        <h1>Your certificate records</h1>
        <p>Renew once. Linked buyers use the current shared record.</p>
      </div>
      <RequestState query={query} noun="certificates">
        <div className="registry-layout">
          <section
            className="certificate-versions"
            aria-label="Current certificate"
          >
            {current ? (
              <CertificateRecord record={current} />
            ) : (
              <div className="empty-state">
                <h2>No certificate on record yet.</h2>
                <p>Add the supplier document and the products it covers.</p>
              </div>
            )}
            {previous.length > 0 && (
              <details className="previous-certificates">
                <summary>Previous versions ({previous.length})</summary>
                {previous.map((c) => (
                  <CertificateRecord key={c.id} record={c} />
                ))}
              </details>
            )}
          </section>
          {saved ? (
            <section className="renewal-receipt">
              <h2 ref={success} tabIndex={-1}>
                Renewal saved.
              </h2>
              <p>{saved.cert_no}</p>
              <p>
                The new record is active. Linked masterlists use it when they
                refresh; coverage still depends on the delivered product and
                brand.
              </p>
              <button className="button quiet" onClick={() => setSaved(null)}>
                Prepare another renewal
              </button>
            </section>
          ) : (
            <RenewalForm
              key={current?.id || "new"}
              current={current}
              onSaved={setSaved}
            />
          )}
        </div>
      </RequestState>
    </div>
  );
}
