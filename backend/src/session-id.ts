// Call only after the provider has authenticated the exact token.
export function authenticatedSessionId(token: string, uid: string): string | null {
  try {
    const parts=token.split(".");
    if(parts.length!==3) return null;
    const claims=JSON.parse(Buffer.from(parts[1] ?? "", "base64url").toString("utf8"));
    return claims.sub===uid && typeof claims.session_id==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id) ? claims.session_id : null;
  } catch { return null; }
}
