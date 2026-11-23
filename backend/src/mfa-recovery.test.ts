import { describe, it, expect } from "vitest";
import { canRequestLostMfaRecovery as allowed } from "./mfa-recovery.js";
const sid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const base={role:"customer" as const,sessionId:sid,emailConfirmed:true,aal:"aal1",hasVerifiedTotp:true};
describe("lost MFA recovery intake never grants privileged access",()=>{
  it("accepts verified AAL1 users for intake only",()=>expect(allowed(base)).toBe(true));
  it("accepts owner/admin intake without permitting factor resets",()=>{
    expect(allowed({...base,role:"owner"})).toBe(true);
    expect(allowed({...base,role:"admin"})).toBe(true);
  });
  it("rejects unverified email, no factor, missing or forged session",()=>{
    for(const input of [{...base,emailConfirmed:false},{...base,hasVerifiedTotp:false},
      {...base,sessionId:"invalid"},{...base,aal:"unknown"}])expect(allowed(input)).toBe(false);
  });
  it("rejects noncanonical role values",()=>{
    expect(allowed({...base,role:"superuser" as "owner"})).toBe(false);
  });
});
