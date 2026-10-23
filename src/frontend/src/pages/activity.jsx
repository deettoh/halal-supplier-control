import React, { useState } from "react";
import { useRecord } from "../lib/api/hooks.js";
import { formatTime, label } from "../lib/format.js";
import { RequestState } from "../components/request-state.jsx";
export default function Activity() {
  const query = useRecord("listActivity");
  const [search, setSearch] = useState("");
  const rows = [...(query.data || [])]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .filter((r) =>
      [r.actor, r.role, r.action, r.reason || "", String(r.delivery_id || "")]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    );
  return (
    <div className="page activity-page">
      <div className="page-intro">
        <h1>Activity</h1>
        <p>
          Delivery checks, recorded decisions and shared certificate renewals.
          Times shown in Malaysia (UTC+8).
        </p>
      </div>
      <RequestState query={query} noun="activity">
        <div className="field activity-search">
          <label htmlFor="activity-search">Search activity</label>
          <input
            id="activity-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Actor, action, delivery or reason"
          />
        </div>
        {rows.length ? (
          <ol className="activity-records">
            {rows.map((r) => (
              <li key={r.id}>
                <time dateTime={r.created_at}>{formatTime(r.created_at)}</time>
                <div className="activity-actor">
                  <strong>{r.actor}</strong>
                  <small>{label(r.role)}</small>
                </div>
                <div>
                  <h2>
                    {label(r.action).replace(/^./, (c) => c.toUpperCase())}
                  </h2>
                  {r.delivery_id !== null && <p>Delivery #{r.delivery_id}</p>}
                </div>
                <p>{r.reason || "No reason recorded."}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-state">
            <h2>
              {query.data?.length
                ? "No matching activity."
                : "No activity recorded yet."}
            </h2>
            <p>
              {query.data?.length
                ? "Try another actor, delivery or reason."
                : "Checks and decisions will appear here."}
            </p>
            {search && (
              <button className="button quiet" onClick={() => setSearch("")}>
                Clear search
              </button>
            )}
          </div>
        )}
      </RequestState>
    </div>
  );
}
