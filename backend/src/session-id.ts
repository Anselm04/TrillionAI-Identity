// Call only after Supabase has authenticated the exact bearer token.
export function validatedSessionId(token: string, userId: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const claims: unknown = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8"));
    if (!claims || typeof claims !== "object") return null;
    const { sub, session_id } = claims as Record<string, unknown>;
    return sub === userId && typeof session_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session_id) ? session_id : null;
  } catch { return null; }
}
