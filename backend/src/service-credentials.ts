import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

/** High-entropy application service credentials. NOT OAuth client secrets or JWTs. */
export const serviceKeyPrefix = "tai_sk_";
const secretPattern = /^tai_sk_[0-9a-f]{64}$/;
export const credentialName = z.string().trim().min(1).max(100);
export const credentialTtlDays = z.number().int().min(1).max(90);
export const credentialScopes = z.array(z.enum(["identity:service:read"]))
  .min(1).max(1);
export const credentialIssueInput = z.object({
  name: credentialName,
  expires_in_days: credentialTtlDays.default(30),
  scopes: credentialScopes.default(["identity:service:read"]),
}).strict();

export function digestServiceKey(secret: string): string {
  if (!secretPattern.test(secret)) throw Error("invalid_service_credential");
  return createHash("sha256").update(secret, "utf8").digest("hex");
}
export function issueServiceKey(now = Date.now(), days = 30) {
  if (!Number.isInteger(days) || days < 1 || days > 90 || !Number.isFinite(now)) {
    throw Error("invalid_service_credential_expiry");
  }
  const secret = serviceKeyPrefix + randomBytes(32).toString("hex");
  return { secret, digest: digestServiceKey(secret), expiresAt: new Date(now + days * 86400_000).toISOString() };
}
// Useful when comparing an offline expected digest without exposing string timing.
export function matchesServiceKeyDigest(secret: string, expectedHex: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(expectedHex)) return false;
  try {
    return timingSafeEqual(Buffer.from(digestServiceKey(secret), "hex"), Buffer.from(expectedHex, "hex"));
  } catch { return false; }
}
