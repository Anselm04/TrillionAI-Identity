import type { Role } from "./authz.js";
/** This controls intake only. It never authorizes factor removal or account access. */
export function canRequestLostMfaRecovery(input: {
  role: Role; sessionId: string; emailConfirmed: boolean;
  aal: string; hasVerifiedTotp: boolean;
}): boolean {
  return ["customer","admin","owner"].includes(input.role)
    && input.emailConfirmed && (input.aal === "aal1" || input.aal === "aal2")
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.sessionId)
    && input.hasVerifiedTotp;
}
