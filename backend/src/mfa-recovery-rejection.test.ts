import { describe,it,expect } from "vitest";
import { mayRejectRecovery as allowed,recoveryRejectionInput,recoveryRejectionCaseId } from "./mfa-recovery-rejection.js";
const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const user="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const session="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const base={actorId:owner,caseUserId:user,sessionId:session,role:"owner" as const,aal:"aal2",recentMfaAt:1000,now:1100};
describe("MFA recovery rejection gate",()=>{
 it("accepts only fresh owner decision as an eligibility check",()=>{
  expect(allowed(base)).toBe(true);
  expect(recoveryRejectionInput.parse({confirm:"REJECT"})).toEqual({confirm:"REJECT"});
 });
 it("does not allow claimant self-rejection or non-owner finalization",()=>{
  expect(allowed({...base,caseUserId:owner})).toBe(false);
  expect(allowed({...base,role:"admin"})).toBe(false);
  expect(allowed({...base,role:"customer"})).toBe(false);
 });
 it("requires valid active-session identifier and a recent provider MFA event",()=>{
  for(const change of [{sessionId:"bad"},{actorId:"bad"},{caseUserId:"bad"},
    {aal:"aal1"},{recentMfaAt:199},{recentMfaAt:1101},{recentMfaAt:undefined}])
    expect(allowed({...base,...change})).toBe(false);
 });
 it("rejects confirmation tampering, extra parameters and unknown identifiers",()=>{
  for(const input of [{},{confirm:"APPROVE"},{confirm:"REJECT",factor_id:user},
    {confirm:"REJECT",unlock:true},{confirm:"reject"}])
    expect(recoveryRejectionInput.safeParse(input).success).toBe(false);
  expect(recoveryRejectionCaseId.safeParse("not-a-user-id").success).toBe(false);
 });
});
