import { useRef, useState } from "react";
import { useScopedOperation } from "./use-scoped-operation";
import { api } from "./api";
type Plan={id:string};
export function BillingCheckout(){
 const [plans,setPlans]=useState<Plan[]|null>(null);
 const [entitlements,setEntitlements]=useState<{active:boolean;grants:{subscriptionId:string;plan:string;accessUntil:string}[]}|null>(null);
 const attempts=useRef(new Map<string,string>());
 const {busy,message,run,current}=useScopedOperation(()=>{setPlans(null);setEntitlements(null);attempts.current.clear();});
 async function load(ticket:number){
  const r=await api<{plans:Plan[]}>("/account/billing/plans");
  if(!current(ticket))return;
  if(!r.ok)throw Error(r.error);
  if(!Array.isArray(r.data.plans))throw Error("Invalid plan response");
  setPlans(r.data.plans);
 }
 async function loadEntitlements(ticket:number){
  const r=await api<{active:boolean;grants:{subscriptionId:string;plan:string;accessUntil:string}[]}>("/account/entitlements");
  if(!current(ticket))return;
  if(!r.ok){setEntitlements(null);throw Error(r.error);}
  setEntitlements(r.data);
 }
 async function checkout(ticket:number,plan:string){
  let attempt=attempts.current.get(plan);
  if(!attempt){attempt=crypto.randomUUID();attempts.current.set(plan,attempt);}
  const r=await api<{url:string}>("/account/billing/checkout","POST",{plan,attempt});
  if(!current(ticket))return;
  if(!r.ok)throw Error(r.error);
  const url=new URL(r.data.url);
  if(url.protocol!=="https:"||url.hostname!=="checkout.stripe.com"||url.username||url.password||url.port)throw Error("Invalid checkout destination");
  window.location.assign(url.href);
 }
 return <div>
  <button disabled={busy} onClick={()=>void run(loadEntitlements)}>Check subscription access</button>
  {entitlements&&<><p>{entitlements.active?"Subscription access active":"No current paid access"}</p>{entitlements.grants.map(g=><p key={g.subscriptionId}>{g.plan}: access until {new Date(g.accessUntil).toLocaleString()}</p>)}</>}
  <button disabled={busy} onClick={()=>void run(load)}>View available plans</button>
  {plans?.length===0&&<p>No subscription plans are currently configured.</p>}
  {plans?.map(p=><div className="box" key={p.id}><b>{p.id}</b><p>Review the price and recurring payment terms on Stripe before purchase.</p><button disabled={busy} onClick={()=>void run(ticket=>checkout(ticket,p.id))}>Continue to checkout</button></div>)}
  {message&&<p role="status">{message}</p>}
 </div>;
}
