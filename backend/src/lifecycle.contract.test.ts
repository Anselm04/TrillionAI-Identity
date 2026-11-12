import { describe, it, expect } from "vitest";
import { directBillingIsCancelled, storeSubscriptionsRequireAcknowledgement } from "./deletion.js";
import { checkAccess } from "./authz.js";
import { canAccessOrganisation } from "./organisation.js";
import type { Subscription } from "./hooks.js";
const at = 1_000_000;
const subscription = (store: Subscription["store"], status: Subscription["status"]): Subscription => ({
  id:"s",plan:"P",amountLabel:"$10",renewsAt:null,accessUntil:null,store,status,
});
describe("identity security regression", () => {
  it("denies an org owner who is not a member of another org",()=>{
    expect(canAccessOrganisation(null,"organisation:read",null)).toBe(false);
    expect(canAccessOrganisation(null,"organisation:manage",null)).toBe(false);
  });
  it("requires active membership even for tenant owner",()=>{
    expect(canAccessOrganisation("owner","organisation:manage","suspended")).toBe(false);
  });
  it("requires fresh owner MFA and trusted role",()=>{
    const common = { required:"owner" as const,emailConfirmed:true,aal:"aal2",mfaEnrolled:true,recentMfaAt:at-10,now:at };
    expect(checkAccess({...common,role:"customer"})).toMatchObject({ok:false,status:403});
    expect(checkAccess({...common,role:"owner",recentMfaAt:at-1000})).toMatchObject({ok:false,code:"reauth_required"});
    expect(checkAccess({...common,role:"owner"})).toEqual({ok:true});
  });
  it("will not mistake direct past due for cancelled",()=>{
    expect(directBillingIsCancelled([subscription("direct","past_due")])).toBe(false);
  });
  it("requires warning about active store subscriptions",()=>{
    expect(storeSubscriptionsRequireAcknowledgement([subscription("apple","active")])).toBe(true);
    expect(storeSubscriptionsRequireAcknowledgement([subscription("google","cancelled")])).toBe(false);
  });
});
