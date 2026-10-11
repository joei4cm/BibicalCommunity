/**
 * Licensed R2 corpus access policy.
 *
 * Development skips entitlement so local scaffolds/R2 seeds stay reachable.
 * Production requires an authenticated, entitled user — except boot-default
 * translations (和合本), which are granted to any signed-in user so
 * chapter navigation works before a full commercial entitlement flow exists.
 */

export type LicensedAccessDecision =
  | {
      ok: true;
      reason: "not_licensed" | "development_skip" | "entitled" | "boot_default";
    }
  | { ok: false; status: 401 | 403; error: "unauthorized" | "entitlement_required" };

export function decideLicensedChapterAccess(input: {
  license: string;
  environment: string;
  userId: string | null;
  entitled: boolean;
  /** Boot-default tids (cuvs): allow any authenticated reader. */
  bootDefault?: boolean;
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
  if (input.entitled) {
    return { ok: true, reason: "entitled" };
  }
  if (input.bootDefault) {
    return { ok: true, reason: "boot_default" };
  }
  return { ok: false, status: 403, error: "entitlement_required" };
}
