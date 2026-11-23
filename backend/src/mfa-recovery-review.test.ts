import { describe,it,expect } from "vitest";
import { mayAttestRecoveryReview as allowed, recoveryReviewInput } from "./mfa-recovery-review.js";
const a="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",b="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",c="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const base={reviewerId:a,caseUserId:b,reviewerRole:"admin" as const,reviewerSession:c,aal:"aal2",recentMfaAt:1000,now:1100};
const evidence={outcome:"identity_evidence_sighted",method:"in_person",evidence_reference_sha256:"a".repeat(64)};
describe("lost MFA independent attestations",()=>{
  it("allows a fresh privileged reviewer not reviewing themselves",()=>expect(allowed(base)).toBe(true));
  it("denies a case owner reviewing themselves",()=>expect(allowed({...base,caseUserId:a})).toBe(false));
  it("denies customers, AAL1 and expired/future TOTP",()=>{
    expect(allowed({...base,reviewerRole:"customer"})).toBe(false);
    expect(allowed({...base,aal:"aal1"})).toBe(false);
    expect(allowed({...base,recentMfaAt:100})).toBe(false);
    expect(allowed({...base,recentMfaAt:1101})).toBe(false);
  });
  it("denies malformed account and session IDs",()=>{
    for(const update of [{reviewerId:"bad"},{caseUserId:"bad"},{reviewerSession:"bad"}])
      expect(allowed({...base,...update})).toBe(false);
  });
  it("accepts only review metadata without identity documents, tokens or approvals",()=>{
    expect(recoveryReviewInput.parse(evidence)).toEqual(evidence);
    for(const invalid of [{...evidence,evidence_reference_sha256:"short"},{...evidence,method:"email_only"},
      {...evidence,outcome:"approved"},{...evidence,code:"123456"},{...evidence,user_id:a}])
      expect(recoveryReviewInput.safeParse(invalid).success).toBe(false);
  });
});
