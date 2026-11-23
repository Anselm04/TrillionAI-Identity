// Call only after the provider has authenticated the exact token.
export function authenticatedSessionId(token: string, uid: string): string | null {
  try {
    const parts=token.split(".");
    if(parts.length!==3) return null;
    const claims=JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8"));
    return claims.sub===uid && typeof claims.session_id==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id) ? claims.session_id : null;
  } catch { return null; }
}


// Inspect only after Supabase Auth has validated the bearer token with getUser().
// A third-party OAuth authorization token must not double as an Identity
// account-management token. Never use these unverified claims for granting access.
export function authenticatedIdentityTokenAudience(token: string, uid: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const claims: unknown = JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8"));
    if (!claims || typeof claims !== "object") return false;
    const payload = claims as Record<string, unknown>;
    // Reject every OAuth client-bound token, even when the user is the owner.
    // The browser/mobile first-party app should use ordinary Supabase sessions.
    return payload.sub === uid && !Object.prototype.hasOwnProperty.call(payload, "client_id");
  } catch {
    return false;
  }
}


/**
 * Called only after Supabase Auth has validated the exact access token using
 * getUser(token), and after its session ID has passed the active-session RPC.
 * Supabase's issuer-signed `aal` and `amr` claims are then safe to consume;
 * a detached anonymous Supabase client has no user session and must not be
 * queried with getAuthenticatorAssuranceLevel() as if it accepted a token.
 */
export function authenticatedSessionAssurance(token: string, uid: string):
  { aal: "aal1" | "aal2"; methods: unknown[] } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || parts[1]!.length > 8192) return null;
    const claims: unknown = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8"));
    if (!claims || typeof claims !== "object") return null;
    const data = claims as Record<string, unknown>;
    if (data.sub !== uid || (data.aal !== "aal1" && data.aal !== "aal2") ||
        !Array.isArray(data.amr)) return null;
    // The token comes from Supabase Auth, not from request-body claims.
    // Reject unexpected AMR structures rather than inventing step-up proof.
    if (data.amr.length > 32 || data.amr.some(v => !v || typeof v !== "object" ||
        Array.isArray(v))) return null;
    return { aal: data.aal, methods: data.amr };
  } catch { return null; }
}
