import { createHash } from "node:crypto";
type Requester = typeof fetch;
export type CheckoutPlan = {id:string;priceId:string};
export function parseCheckoutPlans(raw:string|undefined):CheckoutPlan[]{
 if(!raw)return [];
 const parsed:unknown=JSON.parse(raw);
 if(!Array.isArray(parsed)||parsed.length>50)throw Error("invalid_checkout_plans");
 const seen=new Set<string>();
 return parsed.map(p=>{
  if(!p||typeof p.id!=="string"||!/^[a-z][a-z0-9_-]{0,63}$/.test(p.id)||typeof p.priceId!=="string"||!/^price_[A-Za-z0-9]+$/.test(p.priceId)||seen.has(p.id))throw Error("invalid_checkout_plan");
  seen.add(p.id);return {id:p.id,priceId:p.priceId};
 });
}
export function createCheckoutProvider(secret:string, appUrl:string, request:Requester=fetch){
 const base=new URL(appUrl);
 if(base.protocol!=="https:" && !(base.protocol==="http:"&&["localhost","127.0.0.1"].includes(base.hostname)))throw Error("invalid_checkout_origin");
 if(base.username||base.password)throw Error("invalid_checkout_origin");
 async function post<T>(path:string,body:URLSearchParams,key:string):Promise<T>{
  const res=await request("https://api.stripe.com/v1"+path,{method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),headers:{Authorization:"Bearer "+secret,"Stripe-Version":"2025-02-24.acacia","Content-Type":"application/x-www-form-urlencoded","Idempotency-Key":key},body});
  if(!res.ok)throw Error("stripe_checkout_unavailable");
  return await res.json() as T;
 }
 function idempotency(...parts:string[]){return "identity-"+createHash("sha256").update(JSON.stringify(parts)).digest("hex");}
 return {
  async createCustomer(uid:string):Promise<string>{
   const customer=await post<{id:string}>("/customers",new URLSearchParams({"metadata[identity_user_id]":uid}),idempotency("customer",uid));
   if(!/^cus_[A-Za-z0-9]+$/.test(customer.id))throw Error("invalid_customer_response");
   return customer.id;
  },
  async checkout(uid:string,customer:string,plan:CheckoutPlan,attempt:string):Promise<string>{
   if(!/^cus_[A-Za-z0-9]+$/.test(customer))throw Error("invalid_customer");
   const success=new URL("/",base);success.searchParams.set("billing","success");
   const cancel=new URL("/",base);cancel.searchParams.set("billing","cancelled");
   const session=await post<{url:string}>("/checkout/sessions",new URLSearchParams({
    customer,mode:"subscription","line_items[0][price]":plan.priceId,"line_items[0][quantity]":"1",
    success_url:success.href,cancel_url:cancel.href,client_reference_id:uid,
    "subscription_data[metadata][identity_user_id]":uid
   }),idempotency("checkout",uid,customer,plan.id,attempt));
   const url=new URL(session.url);
   if(url.protocol!=="https:"||url.hostname!=="checkout.stripe.com"||url.username||url.password)throw Error("invalid_checkout_url");
   return url.href;
  }
 };
}
