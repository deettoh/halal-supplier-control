import React from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  ClipboardList,
  History,
  PackageCheck,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { useLocation } from "wouter";
import { useSession, organisationName } from "../lib/session.jsx";
import { AppLink } from "../lib/navigation.jsx";
import { label } from "../lib/format.js";
import { LoupeBrand } from "./loupe-brand.jsx";
export function Shell({ children }) {
  const session = useSession();
  const [path] = useLocation();
  const role = session.identity.role;
  const links =
    role === "reviewer"
      ? [["/registry", "Registry renewals", ShieldCheck]]
      : role === "supplier"
        ? [["/certificates", "Certificates", FileText]]
        : role === "staff"
          ? [
              ["/check", "Check delivery", PackageCheck],
              ["/masterlist", "Masterlist", ClipboardList],
            ]
          : [
              ["/review", "Review deliveries", FileText],
              ["/masterlist", "Masterlist", ClipboardList],
              ["/activity", "Activity", History],
            ];
  return (
    <div className="app-shell signal-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="navigation-rail">
        <AppLink href="/" className="wordmark" aria-label="Loupe home">
          <LoupeBrand />
        </AppLink>
        <nav aria-label="Workspace">
          {links.map(([href, text, Icon]) => (
            <AppLink
              key={href}
              href={href}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={26} aria-hidden="true" />
              {text}
            </AppLink>
          ))}
        </nav>
      </aside>
      <div className="workspace">
        <header className="workspace-header">
          <div>
            <strong>{organisationName(session.identity)}</strong>
            <p>
              <span className="person-name">{session.identity.name}</span> ·{" "}
              {session.identity.title || label(role)}
            </p>
          </div>
          <AppLink href="/demo" className="button workspace-switch">
            <ArrowLeftRight size={22} aria-hidden="true" />
            Switch workspace
            <ChevronDown size={18} aria-hidden="true" />
          </AppLink>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
