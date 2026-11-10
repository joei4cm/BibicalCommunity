import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getToken } from "../lib/api";

/** Require a stored session token before rendering the signed-in app shell. */
export function AuthGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [token, setTokenState] = useState<string | null>(() => getToken());

  useEffect(() => {
    const sync = () => setTokenState(getToken());
    sync();
    window.addEventListener("lh:auth-lost", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("lh:auth-lost", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  if (!token) {
    // Keep query (?verse=) so post-login deep links still land on the verse.
    const from = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to="/app/login?reason=session_expired"
        replace
        state={{ from }}
      />
    );
  }
  return <>{children}</>;
}
