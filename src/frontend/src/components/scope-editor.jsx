import React, { useEffect, useId, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
export function ScopeEditor({ rows, onChange, disabled = false }) {
  const prefix = useId();
  const [focusRow, setFocusRow] = useState(null);
  const addButton = useRef(null);
  useEffect(() => {
    if (focusRow === "add") addButton.current?.focus();
    else if (focusRow) document.getElementById(prefix + focusRow)?.focus();
  }, [focusRow, prefix]);
  function add() {
    const row_id = crypto.randomUUID();
    onChange([...rows, { row_id, product_name: "", brand: "" }]);
    setFocusRow(row_id);
  }
  function remove(index) {
    const target = rows[index + 1]?.row_id || rows[index - 1]?.row_id || "add";
    onChange(rows.filter((_, i) => i !== index));
    setFocusRow(target);
  }
  function update(index, key, value) {
    onChange(rows.map((r, i) => (i === index ? { ...r, [key]: value } : r)));
  }
  return (
    <fieldset className="scope-editor" disabled={disabled}>
      <legend>Products covered</legend>
      <p>
        Leave brand empty to cover any brand of that product. Other
        approved-material checks still apply.
      </p>
      <div className="scope-headings" aria-hidden="true">
        <span>Product</span>
        <span>Brand restriction (optional)</span>
        <span></span>
      </div>
      <ol>
        {rows.map((r, index) => (
          <li key={r.row_id}>
            <div className="field">
              <label className="sr-only" htmlFor={prefix + r.row_id}>
                Product {index + 1}
              </label>
              <input
                id={prefix + r.row_id}
                value={r.product_name}
                onChange={(e) => update(index, "product_name", e.target.value)}
                placeholder="Product name"
                required
              />
            </div>
            <div className="field">
              <label className="sr-only" htmlFor={prefix + "brand" + r.row_id}>
                Brand restriction {index + 1} (optional)
              </label>
              <input
                id={prefix + "brand" + r.row_id}
                value={r.brand}
                onChange={(e) => update(index, "brand", e.target.value)}
                placeholder="Any brand"
              />
            </div>
            <button
              type="button"
              className="button quiet scope-remove"
              aria-label={"Remove product " + (index + 1)}
              onClick={() => remove(index)}
            >
              <X size={16} aria-hidden="true" />
              <span>Remove</span>
            </button>
          </li>
        ))}
      </ol>
      {rows.length === 0 && (
        <p className="field-error">
          Add at least one product covered by this certificate.
        </p>
      )}
      <button
        type="button"
        ref={addButton}
        className="button quiet"
        onClick={add}
      >
        <Plus size={18} aria-hidden="true" />
        Add product
      </button>
    </fieldset>
  );
}
