import { authenticatedIdentityTokenAudience, authenticatedSessionId, authenticatedSessionAssurance } from "./session-id.js";
import type { Request, RequestHandler } from "express";
import { admin, publicAuthClient } from "./supabase.js";
import { checkAccess, type Role } from "./authz.js";
import { latestVerifiedTotpTimestamp } from "./mfa.js";

export type Principal = { sessionId: string; uid: string; email: string; role: Role; token: string; aal: string; totpFactorId?: string };
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
      if (!authenticatedIdentityTokenAudience(token, user.id)) { res.status(403).json({ error: "oauth_client_token_forbidden" }); return; }
      const sessionId = authenticatedSessionId(token,user.id);
      if (!sessionId) { res.status(401).json({error:"invalid_session"}); return; }
      const {data: active,error: sessionError} = await admin.rpc("identity_session_active",{p_user:user.id,p_session:sessionId});
      if (sessionError || typeof active !== "boolean") { res.status(503).json({error:"session_validation_unavailable"}); return; }
      if (!active) { res.status(401).json({error:"session_revoked"}); return; }
      if (!user.email_confirmed_at) { res.status(403).json({ error: "email_verification_required" }); return; }
      const { data: roleRow, error: roleError } = await admin.from("identity_global_roles").select("role").eq("user_id", user.id).maybeSingle();
      if (roleError || (roleRow && !["owner","admin"].includes(roleRow.role))) {
        res.status(503).json({ error: "authorization_unavailable" }); return;
      }
      const role: Role = (roleRow?.role as Role | undefined) ?? "customer";
      // Supabase Auth already verified this bearer with getUser(token), and
      // Identity validated its active session above. Use only that validated
      // token's issuer-signed MFA claims, never untrusted client input.
      const assurance = authenticatedSessionAssurance(token, user.id);
      if (!assurance) { res.status(401).json({ error: "invalid_assurance" }); return; }
      const factor = user.factors?.find(f => f.factor_type === "totp" && f.status === "verified");
      const aal = assurance.aal;
      const latestTotp = latestVerifiedTotpTimestamp(assurance.methods);
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
      req.principal = { sessionId, uid: user.id, email: user.email ?? "", role, token, aal, totpFactorId: factor?.id };
      next();
    } catch (error) { next(error); }
  };
}
