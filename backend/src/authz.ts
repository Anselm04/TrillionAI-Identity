export type Role = "customer" | "admin" | "owner";
export type AccessDecision = { ok: true } | { ok: false; status: number; code: string };
export function checkAccess(input: {
  role: Role; required: Role; emailConfirmed: boolean; aal: string | undefined;
  mfaEnrolled: boolean; recentMfaAt?: number; now?: number;
}): AccessDecision {
  if (!input.emailConfirmed) return { ok: false, status: 403, code: "email_verification_required" };
  const permitted = input.required === "customer" ||
    (input.required === "admin" && (input.role === "admin" || input.role === "owner")) ||
    (input.required === "owner" && input.role === "owner");
  if (!permitted) return { ok: false, status: 403, code: "forbidden" };
  if (input.required === "customer") {
    return input.mfaEnrolled && input.aal !== "aal2"
      ? { ok: false, status: 401, code: "mfa_required" } : { ok: true };
  }
  if (!input.mfaEnrolled || input.aal !== "aal2") return { ok: false, status: 401, code: "mfa_required" };
  // AAL2 alone is not evidence of a fresh challenge. Privileged mutations also
  // require a recent verified authenticator event, if an audit-safe proof exists.
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (!input.recentMfaAt || input.recentMfaAt > now || now - input.recentMfaAt > 15 * 60)
    return { ok: false, status: 401, code: "reauth_required" };
  return { ok: true };
}
