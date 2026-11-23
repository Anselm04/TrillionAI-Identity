import { z } from "zod";
import type { Role } from "./authz.js";

/** Rejection closes an evidence-disputed case. It does not confer recovery rights. */
export const recoveryRejectionInput=z.object({confirm:z.literal("REJECT")}).strict();
export const recoveryRejectionCaseId=z.string().uuid();
const validUuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function mayRejectRecovery(input:{
  actorId:string; caseUserId:string; sessionId:string; role:Role;
  aal:string; recentMfaAt?:number; now?:number;
}):boolean{
  const now=input.now??Math.floor(Date.now()/1000);
  return validUuid.test(input.actorId)&&validUuid.test(input.caseUserId)&&validUuid.test(input.sessionId)
    &&input.actorId.toLowerCase()!==input.caseUserId.toLowerCase()
    &&input.role==="owner"&&input.aal==="aal2"
    &&Number.isSafeInteger(now)&&typeof input.recentMfaAt==="number"
    &&Number.isSafeInteger(input.recentMfaAt)&&input.recentMfaAt>0
    &&input.recentMfaAt<=now && now-input.recentMfaAt<=900;
}
