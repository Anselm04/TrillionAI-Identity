import test from "node:test";
import assert from "node:assert/strict";
import { checkAccess } from "../src/authz.ts";
import { canAccessOrganisation } from "../src/organisation.ts";
import { latestVerifiedTotpTimestamp } from "../src/mfa.ts";
import { cancelDirectSubscriptionVerified } from "../src/billing.ts";

test("customer verified email can access without compulsory MFA",()=>{
  assert.deepEqual(checkAccess({role:"customer",required:"customer",emailConfirmed:true,aal:"aal1",mfaEnrolled:false}),{ok:true});
});
test("unverified customer is denied",()=>{
  assert.equal(checkAccess({role:"customer",required:"customer",emailConfirmed:false,aal:"aal1",mfaEnrolled:false}).ok,false);
});
test("owner scope cannot be gained from customer status",()=>{
  assert.equal(checkAccess({role:"customer",required:"owner",emailConfirmed:true,aal:"aal2",mfaEnrolled:true,recentMfaAt:100,now:100}).ok,false);
});
test("owner access requires fresh timestamped TOTP step-up",()=>{
  assert.equal(checkAccess({role:"owner",required:"owner",emailConfirmed:true,aal:"aal2",mfaEnrolled:true,recentMfaAt:100,now:110}).ok,true);
  assert.equal(checkAccess({role:"owner",required:"owner",emailConfirmed:true,aal:"aal2",mfaEnrolled:true,recentMfaAt:100,now:1001}).ok,false);
});
test("string-only MFA record never proves recent owner verification",()=>{
  assert.equal(latestVerifiedTotpTimestamp(["password","totp"]),undefined);
});
test("timestamped TOTP record supports both provider spellings",()=>{
  assert.equal(latestVerifiedTotpTimestamp([{method:"totp",timestamp:100},{method:"mfa/totp",timestamp:120}]),120);
});
test("cross-tenant non-members are denied",()=>{
  assert.equal(canAccessOrganisation(null,"organisation:read",null),false);
  assert.equal(canAccessOrganisation(null,"members:manage",null),false);
});
test("suspended owner is denied",()=>assert.equal(canAccessOrganisation("owner","organisation:manage","suspended"),false));
test("staff cannot change membership",()=>assert.equal(canAccessOrganisation("staff","members:manage","active"),false));
const active={id:"sub-1",plan:"Builder",amountLabel:"$199",renewsAt:null,accessUntil:null,store:"direct",status:"active"};
test("missing billing hooks reject cancellation", async()=>{
  await assert.rejects(cancelDirectSubscriptionVerified({},"user",active),{code:"billing_not_connected"});
});
test("cancellation claimed but not reflected in provider status rejects", async()=>{
  const hooks={listSubscriptions:async()=>[active],cancelSubscription:async()=>({cancelled:true,accessUntil:null})};
  await assert.rejects(cancelDirectSubscriptionVerified(hooks,"user",active),{code:"billing_status_not_cancelled"});
});
test("provider-confirmed cancellation accepted", async()=>{
  const hooks={listSubscriptions:async()=>[{...active,status:"cancelled"}],cancelSubscription:async()=>({cancelled:true,accessUntil:null})};
  assert.equal((await cancelDirectSubscriptionVerified(hooks,"user",active)).cancelled,true);
});

test("privileged identities require fresh MFA even on ordinary protected account endpoints",()=>{
 for(const role of ["owner","admin"]){
 const base={role,required:"customer",emailConfirmed:true,aal:"aal1",mfaEnrolled:false,now:1000};
 assert.equal(checkAccess(base).ok,false);
 assert.equal(checkAccess({...base,aal:"aal2",mfaEnrolled:true,recentMfaAt:999}).ok,true);
 assert.equal(checkAccess({...base,aal:"aal2",mfaEnrolled:true,recentMfaAt:1,now:2000}).ok,false);
 }
});
test("unknown role and assurance fail closed",()=>{
 const base={role:"customer",required:"customer",emailConfirmed:true,aal:"aal1",mfaEnrolled:false};
 assert.equal(checkAccess({...base,role:"unknown"}).ok,false);
 assert.equal(checkAccess({...base,aal:undefined}).ok,false);
 assert.equal(checkAccess({...base,aal:"aal3"}).ok,false);
});
test("privileged MFA rejects noninteger, infinite, and future timestamps",()=>{
 const base={role:"owner",required:"owner",emailConfirmed:true,aal:"aal2",mfaEnrolled:true,now:1000};
 for(const recentMfaAt of [NaN,Infinity,999.5,1001,-1,0]) assert.equal(checkAccess({...base,recentMfaAt}).ok,false);
});
