import React from "react";
import { Link, useLocation } from "wouter";
import { useSession } from "./session.jsx";
import { transitionUpdate } from "./motion.js";
export function AppLink({ href, children, onClick, ...props }) {
  const session = useSession();
  const [path, navigate] = useLocation();
  return (
    <Link
      href={href}
      {...props}
      onClick={(event) => {
        if (!session.confirmDiscard()) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
        if (
          event.defaultPrevented ||
          props.target ||
          props.download !== undefined ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          !href.startsWith("/") ||
          href.startsWith("//") ||
          path === href
        )
          return;
        event.preventDefault();
        transitionUpdate(() => navigate(href));
      }}
    >
      {children}
    </Link>
  );
}
export function useAppNavigate() {
  const [, navigate] = useLocation();
  const session = useSession();
  return (path) => {
    if (session.confirmDiscard()) transitionUpdate(() => navigate(path));
  };
}
