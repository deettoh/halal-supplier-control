import React from "react";
import { Link, useLocation } from "wouter";
import { useSession } from "./session.jsx";
export function AppLink({ href, children, onClick, ...props }) {
  const session = useSession();
  return (
    <Link
      href={href}
      {...props}
      onClick={(event) => {
        if (!session.confirmDiscard()) event.preventDefault();
        else onClick?.(event);
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
    if (session.confirmDiscard()) navigate(path);
  };
}
