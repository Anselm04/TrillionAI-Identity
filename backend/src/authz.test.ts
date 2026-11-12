import { describe, expect, it } from "vitest";
import { checkAccess } from "./authz.js";
const now=1000000;
const base={ role:"customer" as const,required:"customer" as const,emailConfirmed:true,aal:"aal1",mfaEnrolled:false,now };
describe("identity boundaries",()=>{
  it("blocks unconfirmed email",()=>expect(checkAccess({...base,emailConfirmed:false})).toMatchObject({ok:false,status:403}));
  it("allows verified customer without sms",()=>expect(checkAccess(base)).toEqual({ok:true}));
  it("blocks owner with customer role",()=>expect(checkAccess({...base,required:"owner",aal:"aal2",mfaEnrolled:true,recentMfaAt:now-30})).toMatchObject({ok:false,status:403}));
  it("blocks owner without MFA",()=>expect(checkAccess({...base,role:"owner",required:"owner",aal:"aal1"})).toMatchObject({ok:false,code:"mfa_required"}));
  it("blocks owner with stale MFA",()=>expect(checkAccess({...base,role:"owner",required:"owner",aal:"aal2",mfaEnrolled:true,recentMfaAt:now-2000})).toMatchObject({ok:false,code:"reauth_required"}));
  it("allows only owner with recent MFA",()=>expect(checkAccess({...base,role:"owner",required:"owner",aal:"aal2",mfaEnrolled:true,recentMfaAt:now-30})).toEqual({ok:true}));
});
