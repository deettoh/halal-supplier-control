import React, { useEffect, useRef, useState } from "react";
import { Camera, Upload, ArrowRight, RotateCcw } from "lucide-react";
import { useSession, useDraft } from "../lib/session.jsx";
import { useRecord, useScopedMutation } from "../lib/api/hooks.js";
import { previewCases } from "../lib/preview/gateway.js";
import { MaterialPicker } from "../components/material-picker.jsx";
import { RequestState, ErrorMessage } from "../components/request-state.jsx";
import { PhotoViewer } from "../components/photo-viewer.jsx";
import {
  DeliveryEvidence,
  firstReviewIssue,
} from "../components/delivery-evidence.jsx";
import { Status } from "../components/status.jsx";
export default function CheckDelivery() {
  const session = useSession();
  const materials = useRecord("listMaterials");
  const [materialId, setMaterialId] = useState(null);
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [inputError, setInputError] = useState(null);
  const [preparing, setPreparing] = useState(false);
  const resultHeading = useRef(null);
  const errorHeading = useRef(null);
  const fileInput = useRef(null);
  const mutation = useScopedMutation(
    (ctx, input) => session.gateway.createDelivery(ctx, input),
    { onSuccess: (value) => setResult(value) },
  );
  const selected = materials.data?.find((m) => m.id === materialId);
  const busy = mutation.isPending || preparing;
  useDraft(!result && (!!image || mutation.isPending));
  useEffect(() => {
    if (result) resultHeading.current?.focus();
  }, [result]);
  useEffect(() => {
    if (mutation.error || inputError) errorHeading.current?.focus();
  }, [mutation.error, inputError]);
  function chooseFile(file) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setImage(null);
      setInputError(new Error("Choose a PNG or JPEG photo."));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImage(null);
      setInputError(new Error("Choose a photo smaller than 10 MiB."));
      return;
    }
    setInputError(null);
    setImage(file);
  }
  function selectPhoto(event) {
    chooseFile(event.currentTarget.files?.[0]);
    // Permit selecting the same photo again after removal or validation failure.
    event.currentTarget.value = "";
  }
  async function prepared(example) {
    setPreparing(true);
    try {
      const response = await fetch(example.image);
      if (!response.ok)
        throw new Error("We couldn't load this prepared photo. Try again.");
      const photo = await response.blob();
      chooseFile(
        new File([photo], example.image.split("/").at(-1), {
          type: photo.type,
        }),
      );
    } catch (error) {
      setInputError(error);
    } finally {
      setPreparing(false);
    }
  }
  function reset() {
    setResult(null);
    setImage(null);
    setMaterialId(null);
    setInputError(null);
    mutation.reset();
    if (fileInput.current) fileInput.current.value = "";
  }
  function submit(event) {
    event.preventDefault();
    if (selected && image && !busy) {
      setInputError(null);
      mutation.mutate({ material_id: selected.id, image });
    }
  }
  return (
    <div className="page check-page">
      <div className="page-intro">
        <h1>Check a delivery</h1>
        <p>Choose the material, then take or upload a label photo.</p>
      </div>
      {result ? (
        <section className="delivery-result confirmed-receipt">
          <h2 tabIndex={-1} ref={resultHeading}>
            {result.status === "pending_review"
              ? "Sent for supervisor review"
              : "Delivery recorded"}
          </h2>
          <p className="result-note">
            {session.gateway.mode === "preview"
              ? "Prepared result. Kept in this preview tab."
              : "The service saved this delivery."}
          </p>
          <p className="receipt-reference">Delivery #{result.id}</p>
          <dl className="result-status">
            <div>
              <dt>Coverage result</dt>
              <dd>
                <Status value={result.verdict} />
              </dd>
            </div>
            <div>
              <dt>Delivery status</dt>
              <dd>
                <Status value={result.status} />
              </dd>
            </div>
          </dl>
          {["substitution", "not_covered", "needs_human"].includes(
            result.verdict,
          ) && (
            <p className="review-result-detail">{firstReviewIssue(result)}</p>
          )}
          {result.error && (
            <p className="request-error">
              Saved for supervisor review. {result.error}
            </p>
          )}
          <DeliveryEvidence
            delivery={result}
            material={selected}
            file={image}
          />
          <button className="button primary next-delivery" onClick={reset}>
            Check next delivery
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <p className="muted">
            This result is available during this visit. Staff history is not
            available from the backend yet.
          </p>
        </section>
      ) : (
        <RequestState query={materials} noun="materials">
          <form onSubmit={submit} className="receiving-form">
            <section className="material-step">
              <h2>Choose the approved material</h2>
              <MaterialPicker
                materials={materials.data || []}
                value={materialId}
                onChange={setMaterialId}
                disabled={busy}
              />
              {selected && (
                <dl className="approved-identity">
                  <div>
                    <dt>Approved brand</dt>
                    <dd>{selected.approved_brand}</dd>
                  </div>
                  <div>
                    <dt>Manufacturer</dt>
                    <dd>{selected.approved_manufacturer}</dd>
                  </div>
                  <div>
                    <dt>Supplier</dt>
                    <dd>{selected.supplier_name}</dd>
                  </div>
                </dl>
              )}
            </section>
            <section className="photo-step">
              <h2>Add a label photo</h2>
              <p className="muted">
                Keep the product name, brand and manufacturer readable.
              </p>
              <div className="field photo-input">
                <label htmlFor="label-photo-input">
                  <Camera size={20} aria-hidden="true" />
                  Label photo
                </label>
                <div className="photo-source-actions">
                  <div className="photo-picker">
                    <input
                      className="photo-file-control"
                      id="label-camera-input"
                      aria-label="Take photo"
                      type="file"
                      accept="image/png,image/jpeg"
                      capture="environment"
                      disabled={!selected || busy}
                      onChange={selectPhoto}
                    />
                    <label
                      className="button quiet photo-file-button"
                      htmlFor="label-camera-input"
                      aria-hidden="true"
                    >
                      <Camera size={18} aria-hidden="true" />
                      Take photo
                    </label>
                  </div>
                  <div className="photo-picker">
                    <input
                      ref={fileInput}
                      className="photo-file-control"
                      id="label-photo-input"
                      type="file"
                      accept="image/png,image/jpeg"
                      disabled={!selected || busy}
                      onChange={selectPhoto}
                    />
                    <label
                      className="button quiet photo-file-button"
                      htmlFor="label-photo-input"
                      aria-hidden="true"
                    >
                      <Upload size={18} aria-hidden="true" />
                      Upload photo
                    </label>
                  </div>
                </div>
                <small>
                  PNG or JPEG, up to 10 MiB. Your original file is submitted.
                </small>
              </div>
              {image && (
                <div
                  className="selected-photo"
                  key={image.name + image.lastModified}
                >
                  <p className="file-name">{image.name}</p>
                  <PhotoViewer file={image} />
                  <button
                    type="button"
                    className="button quiet"
                    disabled={busy}
                    onClick={() => {
                      setImage(null);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                  >
                    <RotateCcw size={17} aria-hidden="true" />
                    Remove photo
                  </button>
                </div>
              )}
              {session.gateway.mode === "preview" && (
                <details className="prepared-photos">
                  <summary>Try a prepared label</summary>
                  <p>
                    This preview checks only the exact prepared photo and
                    material pairs. Other photos need the backend.
                  </p>
                  {selected ? (
                    <ul>
                      {previewCases
                        .filter((c) => c.materialIds.includes(selected.id))
                        .map((c) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              className="button quiet"
                              disabled={busy}
                              onClick={() => prepared(c)}
                            >
                              {c.title}
                            </button>
                            <a href={c.image} download>
                              Download photo
                            </a>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p>
                      Choose Cocoa Powder or Wheat Flour to try a prepared
                      label.
                    </p>
                  )}
                </details>
              )}
            </section>
            <div className="receiving-submit">
              <button
                className="button primary"
                disabled={!selected || !image || busy}
              >
                {mutation.isPending
                  ? "Reading the label and checking the records…"
                  : preparing
                    ? "Preparing photo…"
                    : "Check delivery"}
                {!busy && <ArrowRight size={18} aria-hidden="true" />}
              </button>
              {mutation.isPending && (
                <p role="status">
                  Keep this page open. The check can take a few minutes.
                </p>
              )}
              <div ref={errorHeading} tabIndex={-1}>
                {(mutation.error || inputError) && (
                  <ErrorMessage error={mutation.error || inputError} />
                )}
              </div>
            </div>
          </form>
        </RequestState>
      )}
    </div>
  );
}
