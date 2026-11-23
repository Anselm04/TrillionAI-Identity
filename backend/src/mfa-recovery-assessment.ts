import { z } from "zod";

const uuid = z.string().uuid();
export const assessmentCaseId = uuid;
const reviewRow = z.object({
  reviewer_id: uuid,
  review_outcome: z.enum(["identity_evidence_sighted", "insufficient_evidence"]),
}).strict();
const roleRow = z.object({
  user_id: uuid,
  role: z.enum(["owner", "admin"]),
}).strict();

export type AssessmentStatus =
  | "awaiting_independent_reviews"
  | "evidence_disputed"
  | "owner_reviewer_required"
  | "independent_review_recorded"
  | "owner_recovery_requires_external_governance";

export function assessRecoveryEvidence(
  caseUserId: string,
  requestedRole: "customer" | "admin" | "owner",
  rawReviews: unknown[],
  rawRoles: unknown[],
): {status: AssessmentStatus; independentReviewCount: number; unlockAuthorized: false; mfaResetAuthorized: false} {
  const inputCase = uuid.parse(caseUserId);
  if (!["customer", "admin", "owner"].includes(requestedRole)) throw Error("invalid_case_role");
  if (rawReviews.length > 50 || rawRoles.length > 50) throw Error("unbounded_review_set");
  const reviews = rawReviews.map(row => reviewRow.parse(row));
  const roles = rawRoles.map(row => roleRow.parse(row));
  const activeRoles = new Map(roles.map(row => [row.user_id.toLowerCase(), row.role]));
  const uniqueReviewers = new Set<string>();
  let validCount = 0;
  let ownerSighting = false;
  let disputed = false;
  for (const review of reviews) {
    const uid = review.reviewer_id.toLowerCase();
    if (uniqueReviewers.has(uid)) throw Error("duplicate_reviewer");
    uniqueReviewers.add(uid);
    // A reviewer must be currently privileged and must not be the claimant.
    const role = activeRoles.get(uid);
    if (uid === inputCase.toLowerCase() || !role) continue;
    if (review.review_outcome === "insufficient_evidence") disputed = true;
    else {
      validCount++;
      if (role === "owner") ownerSighting = true;
    }
  }
  let status: AssessmentStatus;
  if (requestedRole === "owner") {
    // Only one global owner exists. Owner self-review is prohibited. There is
    // intentionally no automatic recovery quorum for a lost-owner account.
    status = "owner_recovery_requires_external_governance";
  } else if (disputed) status = "evidence_disputed";
  else if (validCount < 2) status = "awaiting_independent_reviews";
  else if (!ownerSighting) status = "owner_reviewer_required";
  else status = "independent_review_recorded";
  return {status, independentReviewCount: validCount, unlockAuthorized:false, mfaResetAuthorized:false};
}
