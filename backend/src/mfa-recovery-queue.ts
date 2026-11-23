import { z } from "zod";

/** Owner-only review cursor. This module never authorizes recovery actions. */
export const recoveryQueueQuery = z.object({
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
}).strict();

export type RecoveryQueueCase = {
  case_id: string; user_id: string; case_version: number; requested_role: "customer" | "admin" | "owner"; created_at: string;
};
export function recoveryQueuePage(rows: RecoveryQueueCase[], limit: number): {
  cases: RecoveryQueueCase[]; nextCursor: string | null;
} {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50)
    throw Error("invalid_recovery_queue_limit");
  if (rows.length > limit + 1) throw Error("invalid_recovery_queue_page");
  // The query uses ascending user_id, a unique case ID key.
  const cases = rows.slice(0, limit);
  return { cases, nextCursor: rows.length > limit ? cases.at(-1)!.case_id : null };
}
