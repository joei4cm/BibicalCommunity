import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getToken } from "../lib/api";

/** Require a stored session token before rendering the signed-in app shell. */
export function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  if (!getToken()) {
    // Keep query (?verse=) so post-login deep links still land on the verse.
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/app/login" replace state={{ from }} />;
  }
  return <>{children}</>;
}
