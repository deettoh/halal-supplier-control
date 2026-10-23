import React, { lazy, Suspense, useEffect } from "react";
import { useLocation } from "wouter";
import { useSession, homeForRole } from "./lib/session.jsx";
import { AppLink } from "./lib/navigation.jsx";
import { Shell } from "./components/shell.jsx";
const Review = lazy(() => import("./pages/review.jsx"));
import DemoEntry from "./pages/demo-entry.jsx";
import Landing from "./pages/landing.jsx";
const CheckDelivery = lazy(() => import("./pages/check.jsx"));
const Masterlist = lazy(() => import("./pages/masterlist.jsx"));
const Activity = lazy(() => import("./pages/activity.jsx"));
import NotFound from "./pages/not-found.jsx";
const Certificates = lazy(() => import("./pages/certificates.jsx"));
export const roleRoutes = {
  staff: ["/check", "/masterlist"],
  supervisor: ["/review", "/masterlist", "/activity"],
  supplier: ["/certificates"],
};
export default function App() {
  const session = useSession();
  const [path] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    const main = document.querySelector("main");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: true });
    }
  }, [path]);
  if (path === "/") return <Landing />;
  if (path === "/demo") return <DemoEntry />;
  if (!session.identity) return <DemoEntry requestedPath={path} />;
  const pages = {
    "/check": CheckDelivery,
    "/review": Review,
    "/masterlist": Masterlist,
    "/activity": Activity,
    "/certificates": Certificates,
  };
  const Page = pages[path];
  if (Page && !roleRoutes[session.identity.role].includes(path))
    return (
      <Shell>
        <div className="page">
          <h1>This workspace can't open that view.</h1>
          <AppLink
            className="button primary"
            href={homeForRole(session.identity.role)}
          >
            Open your workspace
          </AppLink>
        </div>
      </Shell>
    );
  return (
    <Shell>
      <div className="route-arrival" key={path}>
        <Suspense
          fallback={
            <p className="request-loading" role="status">
              Opening workspace…
            </p>
          }
        >
          {Page ? <Page /> : <NotFound />}
        </Suspense>
      </div>
    </Shell>
  );
}
