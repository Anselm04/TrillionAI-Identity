import { describe, it, expect } from "vitest";
import { cancelDirectSubscriptionVerified } from "./billing.js";
import type { AppHooks, Subscription } from "./hooks.js";
const active: Subscription = { id:"a",plan:"Builder",amountLabel:"$199",
 renewsAt:null,accessUntil:null,status:"active",store:"direct" };
describe("provider-confirmed cancellation",()=>{
  it("denies missing billing adapters", async()=>{
    await expect(cancelDirectSubscriptionVerified({}, "user", active))
      .rejects.toMatchObject({code:"billing_not_connected"});
  });
  it("denies provider rejection", async()=>{
    const hooks:AppHooks={listSubscriptions:async()=>[active],cancelSubscription:async()=>({cancelled:false,accessUntil:null})};
    await expect(cancelDirectSubscriptionVerified(hooks,"user",active))
      .rejects.toMatchObject({code:"provider_cancel_unconfirmed"});
  });
  it("denies provider exceptions", async()=>{
    const hooks:AppHooks={listSubscriptions:async()=>[active],cancelSubscription:async()=>{throw Error("provider error");}};
    await expect(cancelDirectSubscriptionVerified(hooks,"user",active))
      .rejects.toMatchObject({code:"provider_cancel_failed"});
  });
  it("denies claimed success if subscription is still active", async()=>{
    const hooks:AppHooks={listSubscriptions:async()=>[active],cancelSubscription:async()=>({cancelled:true,accessUntil:null})};
    await expect(cancelDirectSubscriptionVerified(hooks,"user",active))
      .rejects.toMatchObject({code:"billing_status_not_cancelled"});
  });
  it("accepts only confirmed cancelled status", async()=>{
    const hooks:AppHooks={listSubscriptions:async()=>[{...active,status:"cancelled"}],
      cancelSubscription:async()=>({cancelled:true,accessUntil:null})};
    await expect(cancelDirectSubscriptionVerified(hooks,"user",active))
      .resolves.toMatchObject({cancelled:true});
  });
});
