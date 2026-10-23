import React, { useState } from "react";
import { Search } from "lucide-react";
import { useRecord } from "../lib/api/hooks.js";
import { formatDate, label } from "../lib/format.js";
import { Status } from "../components/status.jsx";
import { RequestState } from "../components/request-state.jsx";
export default function Masterlist() {
  const query = useRecord("listMaterials");
  const [search, setSearch] = useState("");
  const [coverage, setCoverage] = useState("all");
  const materials = query.data || [];
  const rows = materials.filter(
    (m) =>
      (coverage === "all" || m.coverage_status === coverage) &&
      [m.name, m.supplier_name, m.approved_brand, m.approved_manufacturer].some(
        (value) => value.toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  return (
    <div className="page masterlist-page">
      <div className="page-intro">
        <h1>Materials on record</h1>
        <p>Your approved materials and the supplier documents covering them.</p>
      </div>
      <RequestState query={query} noun="materials">
        <div className="material-toolbar">
          <fieldset className="coverage-filters">
            <legend className="sr-only">Coverage</legend>
            {["all", "covered", "expiring", "not_covered"].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={coverage === value}
                onClick={() => setCoverage(value)}
              >
                {value === "all" ? "All materials" : label(value)}{" "}
                <span>
                  {value === "all"
                    ? materials.length
                    : materials.filter((m) => m.coverage_status === value)
                        .length}
                </span>
              </button>
            ))}
          </fieldset>
          <div className="material-search">
            <label htmlFor="material-search">Search materials</label>
            <div>
              <Search size={19} aria-hidden="true" />
              <input
                type="search"
                id="material-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Material, supplier, brand or manufacturer"
              />
            </div>
          </div>
        </div>
        {rows.length ? (
          <>
            <table className="materials-table" aria-label="Approved materials">
              <thead>
                <tr>
                  <th scope="col">Material</th>
                  <th scope="col">Supplier</th>
                  <th scope="col">Approved brand / manufacturer</th>
                  <th scope="col">Coverage</th>
                  <th scope="col">Certificate expiry</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <th scope="row">{m.name}</th>
                    <td>{m.supplier_name}</td>
                    <td>
                      <strong>{m.approved_brand}</strong>
                      <small>{m.approved_manufacturer}</small>
                    </td>
                    <td>
                      <Status value={m.coverage_status} />
                    </td>
                    <td>{formatDate(m.certificate_expiry_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="material-records" aria-label="Approved materials">
              {rows.map((m) => (
                <li key={m.id}>
                  <h2>{m.name}</h2>
                  <dl>
                    <div>
                      <dt>Supplier</dt>
                      <dd>{m.supplier_name}</dd>
                    </div>
                    <div>
                      <dt>Approved brand</dt>
                      <dd>{m.approved_brand}</dd>
                    </div>
                    <div>
                      <dt>Manufacturer</dt>
                      <dd>{m.approved_manufacturer}</dd>
                    </div>
                    <div>
                      <dt>Coverage</dt>
                      <dd>
                        <Status value={m.coverage_status} />
                      </dd>
                    </div>
                    <div>
                      <dt>Certificate expiry</dt>
                      <dd>{formatDate(m.certificate_expiry_date)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="empty-state">
            <h2>
              {materials.length
                ? "No matching materials."
                : "No materials on record yet."}
            </h2>
            <p>
              {materials.length
                ? "Try another name, supplier or brand."
                : "Approved materials will appear here when they are added to this workspace."}
            </p>
          </div>
        )}
        {(search || coverage !== "all") && (
          <button
            className="button quiet clear-search"
            onClick={() => {
              setSearch("");
              setCoverage("all");
            }}
          >
            Clear search
          </button>
        )}
      </RequestState>
    </div>
  );
}
