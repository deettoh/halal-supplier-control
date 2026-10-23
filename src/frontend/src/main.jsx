import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { SessionProvider } from "./lib/session.jsx";
import { createLiveGateway } from "./lib/api/gateway.js";
import { createPreviewGateway } from "./lib/preview/gateway.js";
import App from "./App.jsx";
import { ErrorBoundary } from "./components/error-boundary.jsx";
const mode = import.meta.env.VITE_API_MODE || "live";
if (!["live", "preview"].includes(mode))
  throw new Error("VITE_API_MODE must be live or preview.");
const gateway =
  mode === "preview"
    ? createPreviewGateway()
    : createLiveGateway({ baseUrl: import.meta.env.VITE_API_BASE_URL || "" });
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <SessionProvider gateway={gateway}>
      <App />
    </SessionProvider>
  </ErrorBoundary>,
);
