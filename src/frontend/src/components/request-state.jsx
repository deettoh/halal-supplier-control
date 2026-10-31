import React from "react";
function fieldName(name) {
  const scope = name.match(/^scope\.(\d+)\.(product_name|brand)$/);
  if (scope)
    return (
      "Product " +
      (Number(scope[1]) + 1) +
      (scope[2] === "brand" ? " brand restriction" : " name")
    );
  return (
    {
      issuer: "Issuer",
      cert_no: "Certificate number",
      holder_name: "Holder name",
      expiry_date: "Expiry date",
      scope: "Products covered",
      image: "Photo",
      reason: "Reason",
      material_id: "Material",
    }[name] || name.replaceAll("_", " ")
  );
}
export function ErrorMessage({ error, onRetry }) {
  if (!error) return null;
  const heading =
    error.status === 501
      ? "This action isn't available in the demo yet"
      : error.status === 422
        ? "Check these fields"
        : error.status === 503
          ? "The service is temporarily unavailable"
          : error.status === 403
            ? "This workspace can't open that view"
            : error.name === "UnsupportedCapabilityError"
              ? error.message.replace(/\.$/, "")
              : "We couldn't complete this request";
  return (
    <div className="request-error" role="alert" tabIndex={-1}>
      <strong>{heading}</strong>
      {error.message !== heading && <p>{error.message}</p>}
      {Object.keys(error.fields || {}).length > 0 && (
        <ul>
          {Object.entries(error.fields).map(([name, message]) => (
            <li key={name}>
              {fieldName(name)}: {message}
            </li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button type="button" className="button quiet" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function RequestState({ query, noun = "records", children }) {
  if (query.isPending)
    return (
      <p className="request-loading" role="status">
        Loading {noun}…
      </p>
    );
  if (query.error && !query.data)
    return <ErrorMessage error={query.error} onRetry={() => query.refetch()} />;
  return (
    <>
      {query.error && (
        <ErrorMessage error={query.error} onRetry={() => query.refetch()} />
      )}{" "}
      {children}
    </>
  );
}
