import { describe, expect, it } from "vitest";
import { directBillingIsCancelled, storeSubscriptionsRequireAcknowledgement } from "./deletion.js";
import type { Subscription } from "./hooks.js";
const sub=(store:Subscription["store"],status:Subscription["status"]):Subscription=>({
 id:"test-id", plan:"test", amountLabel:"test", renewsAt:null, accessUntil:null,store,status
});
describe("subscription/deletion guarantees",()=>{
 it("denies deletion before active direct billing is cancelled",()=>expect(directBillingIsCancelled([sub("direct","active")])).toBe(false));
 it("requires confirmation for store-managed active subscriptions",()=>expect(storeSubscriptionsRequireAcknowledgement([sub("apple","active")])).toBe(true));
 it("recognizes finished cancellations",()=>expect(directBillingIsCancelled([sub("direct","cancelled")])).toBe(true));
 it("does not mistake past-due direct subscriptions for cancelled",()=>expect(directBillingIsCancelled([sub("direct","past_due")])).toBe(false));
 it("does not require store warning for cancelled plans",()=>expect(storeSubscriptionsRequireAcknowledgement([sub("google","cancelled")])).toBe(false));
});
