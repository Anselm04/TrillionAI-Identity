import type { AppHooks, Subscription } from "./hooks.js";

type StripePrice = { unit_amount: number | null; currency: string; nickname?: string | null; recurring?: { interval: string; interval_count: number } | null };
type StripeSubscription = { id: string; customer: string; status: string; cancel_at_period_end: boolean; cancel_at?: number | null; ended_at?: number | null; current_period_end?: number; items: { data: { price: StripePrice; current_period_end?: number }[]; has_more: boolean } };
type CustomerLookup = (uid: string) => Promise<string | null>;
type Fetcher = typeof fetch;
const customerPattern = /^cus_[A-Za-z0-9]+$/;
const subscriptionPattern = /^sub_[A-Za-z0-9]+$/;
function iso(seconds: number | null | undefined): string | null {
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}
export function mapStripeSubscription(s: StripeSubscription): Subscription {
  const end = s.current_period_end ?? Math.max(0, ...s.items.data.map(i => i.current_period_end ?? 0));
  const terminal = ["canceled", "incomplete_expired"].includes(s.status);
  const scheduled = s.cancel_at_period_end || Boolean(s.cancel_at);
  const active = ["active", "trialing"].includes(s.status);
  const status = terminal || scheduled ? "cancelled" : active ? "active" : "past_due";
  const prices = s.items.data.map(i => i.price);
  const plan = prices.map(p => p.nickname || "Subscription").join(" + ") || "Subscription";
  const amountLabel = prices.map(p => {
    if (p.unit_amount === null) return "Variable pricing";
    const currency = p.currency.toUpperCase();
    try {
      const fmt = new Intl.NumberFormat("en", {style:"currency",currency});
      const value = fmt.format(p.unit_amount / Math.pow(10,fmt.resolvedOptions().maximumFractionDigits ?? 2));
      return value + (p.recurring ? " / " + (p.recurring.interval_count === 1 ? "" : p.recurring.interval_count + " ") + p.recurring.interval : "");
    } catch { return "See invoice"; }
  }).join(" + ");
  return {id:s.id,plan,amountLabel,status,store:"direct",renewsAt:active && !scheduled ? iso(end) : null,
    accessUntil: !terminal && active ? iso(Math.min(s.cancel_at ?? end,end)) : null};
}
export function createStripeBilling(secret: string, lookup: CustomerLookup, request: Fetcher = fetch): Pick<AppHooks,"listSubscriptions"|"cancelSubscription"> {
  async function call<T>(path: string, method = "GET", body?: URLSearchParams): Promise<T> {
    const response = await request("https://api.stripe.com/v1"+path,{method,redirect:"error",signal:AbortSignal.timeout(15000),headers:{
      Authorization:"Bearer "+secret,"Stripe-Version":"2025-02-24.acacia",
      ...(body ? {"Content-Type":"application/x-www-form-urlencoded"} : {})
    },...(body ? {body} : {})});
    if(!response.ok) throw new Error("stripe_request_failed");
    return await response.json() as T;
  }
  async function customer(uid:string) {
    const id=await lookup(uid);
    if(id!==null && !customerPattern.test(id)) throw Error("invalid_customer_mapping");
    return id;
  }
  async function retrieve(id:string,cus:string) {
    if(!subscriptionPattern.test(id)) throw Error("invalid_subscription_id");
    const s=await call<StripeSubscription>("/subscriptions/"+encodeURIComponent(id));
    if(s.customer!==cus || s.id!==id) throw Error("subscription_not_found");
    return s;
  }
  return {
    async listSubscriptions(uid) {
      const cus=await customer(uid);
      if(!cus)return [];
      const rows:Subscription[]=[];
      let after:string|undefined;
      for(let page=0;page<1000;page++){
        const query=new URLSearchParams({customer:cus,status:"all",limit:"100"});
        if(after)query.set("starting_after",after);
        const result=await call<{data:StripeSubscription[];has_more:boolean}>("/subscriptions?"+query);
        if(!Array.isArray(result.data))throw Error("invalid_subscription_response");
        for(const s of result.data){
          if(s.customer!==cus || !subscriptionPattern.test(s.id) || s.items.has_more)throw Error("invalid_subscription_response");
          rows.push(mapStripeSubscription(s));
        }
        if(!result.has_more)return rows;
        const next=result.data.at(-1)?.id;
        if(!next||next===after)throw Error("invalid_pagination");
        after=next;
      }
      throw Error("subscription_pagination_limit");
    },
    async cancelSubscription(uid,id) {
      const cus=await customer(uid);
      if(!cus)throw Error("subscription_not_found");
      const before=await retrieve(id,cus);
      if(!["canceled","incomplete_expired"].includes(before.status) && !before.cancel_at_period_end && !before.cancel_at){
        await call("/subscriptions/"+encodeURIComponent(id),"POST",new URLSearchParams({cancel_at_period_end:"true"}));
      }
      const after=mapStripeSubscription(await retrieve(id,cus));
      return {cancelled:after.status==="cancelled",accessUntil:after.accessUntil};
    }
  };
}
