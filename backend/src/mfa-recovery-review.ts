import { z } from "zod";
import type { Role } from "./authz.js";

/** A reviewer attests that outside verification occurred. This grants no access. */
export const recoveryReviewInput = z.object({
  outcome: z.enum(["identity_evidence_sighted","insufficient_evidence"]),
  method: z.enum(["in_person","verified_callback","verified_external_record"]),
  evidence_reference_sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function mayAttestRecoveryReview(input: {
  reviewerId: string; caseUserId: string; reviewerRole: Role;
  reviewerSession: string; aal: string; recentMfaAt?: number; now?: number;
}): boolean {
  const now=input.now??Math.floor(Date.now()/1000);
  return uuid.test(input.reviewerId)&&uuid.test(input.caseUserId)
    &&uuid.test(input.reviewerSession)
    &&input.reviewerId.toLowerCase()!==input.caseUserId.toLowerCase()
    &&(input.reviewerRole==="owner"||input.reviewerRole==="admin")
    &&input.aal==="aal2"
    &&Number.isSafeInteger(now)
    &&typeof input.recentMfaAt==="number"&&Number.isSafeInteger(input.recentMfaAt)
    &&input.recentMfaAt>0&&input.recentMfaAt<=now&&now-input.recentMfaAt<=900;
}
