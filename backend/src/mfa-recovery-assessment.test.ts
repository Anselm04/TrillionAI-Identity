import {describe,it,expect} from "vitest";
import {assessRecoveryEvidence as assess} from "./mfa-recovery-assessment.js";
const c="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const owner="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const admin="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const admin2="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const row=(id:string,review_outcome:"identity_evidence_sighted"|"insufficient_evidence"="identity_evidence_sighted")=>({reviewer_id:id,review_outcome});
const roles=[{user_id:owner,role:"owner"},{user_id:admin,role:"admin"},{user_id:admin2,role:"admin"}];
describe("MFA independent case assessment (read-only)",()=>{
 it("never authorizes provider MFA changes regardless of reviews",()=>{
  const result=assess(c,"customer",[row(owner),row(admin)],roles);
  expect(result).toEqual({status:"independent_review_recorded",independentReviewCount:2,unlockAuthorized:false,mfaResetAuthorized:false});
 });
 it("requires two distinct current reviewers and one current owner",()=>{
  expect(assess(c,"customer",[row(owner)],roles).status).toBe("awaiting_independent_reviews");
  expect(assess(c,"customer",[row(admin),row(admin2)],roles).status).toBe("owner_reviewer_required");
  expect(assess(c,"customer",[row(owner),row(admin)],[{user_id:owner,role:"admin"},{user_id:admin,role:"admin"}]).status).toBe("owner_reviewer_required");
 });
 it("any insufficient evidence is a dispute",()=>{
  expect(assess(c,"customer",[row(owner),row(admin),row(admin2,"insufficient_evidence")],roles).status).toBe("evidence_disputed");
 });
 it("never reports ordinary quorum for owner self-recovery",()=>{
  expect(assess(owner,"owner",[row(admin),row(admin2)],roles).status).toBe("owner_recovery_requires_external_governance");
 });
 it("ignores self-reviews and reviewers who have lost privileged roles",()=>{
  expect(assess(c,"customer",[row(c),row(admin)],roles).independentReviewCount).toBe(1);
  expect(assess(c,"customer",[row(owner),row(admin)],[{user_id:owner,role:"owner"}]).independentReviewCount).toBe(1);
 });
 it("rejects duplicate reviewers and unbounded/invalid database responses",()=>{
  expect(()=>assess(c,"customer",[row(owner),row(owner)],roles)).toThrow("duplicate_reviewer");
  expect(()=>assess(c,"customer",[row("bad")],roles)).toThrow();
  expect(()=>assess(c,"customer",Array(51).fill(row(owner)),roles)).toThrow("unbounded_review_set");
  expect(()=>assess(c,"customer",[{...row(owner),token:"secret"}],roles)).toThrow();
 });
});
