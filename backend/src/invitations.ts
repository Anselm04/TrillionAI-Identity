import { createHash, randomBytes } from "node:crypto";
export const invitationTtlMs = 7 * 24 * 60 * 60 * 1000;
export type InviteRole = "admin" | "staff" | "customer";
export function mayInvite(actorRole: string, status: string, requestedRole: string): boolean {
  return status === "active" && (actorRole === "owner" || actorRole === "admin") &&
    (requestedRole === "staff" || requestedRole === "customer" || (actorRole === "owner" && requestedRole === "admin"));
}
export function invitationDigest(token: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("invalid_invitation");
  return createHash("sha256").update(token).digest("hex");
}
export function issueInvitation(now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  return { token, digest: invitationDigest(token), expiresAt: new Date(now + invitationTtlMs).toISOString() };
}
