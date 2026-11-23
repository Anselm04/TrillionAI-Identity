import { authenticatedIdentityTokenAudience, authenticatedSessionId } from "./session-id.js";

/**
 * Use only AFTER Supabase getUser(access_token) verifies the exact refreshed
 * bearer. A newly issued token is not proof that its auth.sessions row remains
 * active at Identity's authorization boundary.
 */
export function refreshedSessionBinding(input: {
  accessToken: string;
  refreshUserId: string | undefined;
  verifiedUserId: string | undefined;
  verifiedEmailConfirmed: boolean;
}): { userId: string; sessionId: string } | null {
  if (!input.refreshUserId || !input.verifiedUserId ||
      input.refreshUserId !== input.verifiedUserId || !input.verifiedEmailConfirmed ||
      !authenticatedIdentityTokenAudience(input.accessToken, input.verifiedUserId)) return null;
  const sessionId=authenticatedSessionId(input.accessToken,input.verifiedUserId);
  return sessionId ? {userId:input.verifiedUserId,sessionId} : null;
}

/** Any missing or errored inventory result fails closed, never as active. */
export function refreshedSessionDecision(active: unknown, hasError: boolean):
  "active" | "revoked" | "unavailable" {
  if (hasError || typeof active !== "boolean") return "unavailable";
  return active ? "active" : "revoked";
}
