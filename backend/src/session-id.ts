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
