import React from "react";
import { Link } from "wouter";
import { useSession, homeForRole } from "../lib/session.jsx";
export default function NotFound() {
  const { identity } = useSession();
  return (
    <div className="page">
      <h1>This page isn't available</h1>
      <p>Return to your workspace or choose another role.</p>
      <Link
        className="button primary"
        href={identity ? homeForRole(identity.role) : "/demo"}
      >
        Open workspace
      </Link>
    </div>
  );
}
