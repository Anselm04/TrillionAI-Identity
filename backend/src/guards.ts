import type { Request, RequestHandler } from "express";
import { admin, publicAuthClient } from "./supabase.js";
import { checkAccess, type Role } from "./authz.js";
import { latestVerifiedTotpTimestamp } from "./mfa.js";

export type Principal = { uid: string; email: string; role: Role; token: string; aal: string; totpFactorId?: string };
export type AuthRequest = Request & { principal?: Principal };
export function guard(required: Role = "customer", allowMfaPending = false): RequestHandler {
  return async (req: AuthRequest, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.header("authorization") ?? "");
    if (!match) { res.status(401).json({ error: "unauthenticated" }); return; }
    const token = match[1]!;
    try {
      const authClient = publicAuthClient();
      const { data: userData, error: authError } = await authClient.auth.getUser(token);
      if (authError || !userData.user) { res.status(401).json({ error: "unauthenticated" }); return; }
      const user = userData.user;
      if (!user.email_confirmed_at) { res.status(403).json({ error: "email_verification_required" }); return; }
      const { data: roleRow, error: roleError } = await admin.from("identity_global_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (roleError || (roleRow && !["owner","admin"].includes(roleRow.role))) {
        res.status(503).json({ error: "authorization_unavailable" }); return;
      }
      const role: Role = (roleRow?.role as Role | undefined) ?? "customer";
      const { data: mfaData, error: mfaError } = await authClient.auth.mfa.getAuthenticatorAssuranceLevel(token);
      if (mfaError || !mfaData) { res.status(503).json({ error: "mfa_unavailable" }); return; }
      const factor = user.factors?.find(f => f.factor_type === "totp" && f.status === "verified");
      const aal = mfaData.currentLevel ?? "aal1";
      const latestTotp = latestVerifiedTotpTimestamp(mfaData.currentAuthenticationMethods);
      // The AAL comes from validated Supabase Auth (not an unverified JWT decode).
      const needsMfa = Boolean(factor) && aal !== "aal2";
      if (!allowMfaPending || required !== "customer") {
        const decision = checkAccess({ role, required, emailConfirmed: true, aal, mfaEnrolled: Boolean(factor),
          // Use the time of the trusted Supabase MFA event, not the JWT issue time.
          recentMfaAt: latestTotp });
        if (!decision.ok) { res.status(decision.status).json({ error: decision.code }); return; }
      } else if (needsMfa) {
        // allow only MFA completion and logout while still at AAL1.
      }
      req.principal = { uid: user.id, email: user.email ?? "", role, token, aal, totpFactorId: factor?.id };
      next();
    } catch (error) { next(error); }
  };
}
