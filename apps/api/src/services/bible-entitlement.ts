/**
 * Licensed R2 corpus access policy.
 *
 * Development skips entitlement so local scaffolds/R2 seeds stay reachable.
 * Production requires an authenticated, entitled user.
 */

export type LicensedAccessDecision =
  | { ok: true; reason: "not_licensed" | "development_skip" | "entitled" }
  | { ok: false; status: 401 | 403; error: "unauthorized" | "entitlement_required" };

export function decideLicensedChapterAccess(input: {
  license: string;
  environment: string;
  userId: string | null;
  entitled: boolean;
}): LicensedAccessDecision {
  if (input.license !== "licensed") {
    return { ok: true, reason: "not_licensed" };
  }
  if (input.environment === "development") {
    return { ok: true, reason: "development_skip" };
  }
  if (!input.userId) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  if (!input.entitled) {
    return { ok: false, status: 403, error: "entitlement_required" };
  }
  return { ok: true, reason: "entitled" };
}
