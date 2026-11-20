import { useRef, useState } from "react";
import { api } from "./api";
type Plan={id:string};
export function BillingCheckout(){
 const [plans,setPlans]=useState<Plan[]|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const attempts=useRef(new Map<string,string>());
 const pending=useRef(false);
 async function run(work:()=>Promise<void>){
  if(pending.current)return;
  pending.current=true;setBusy(true);setMessage("");
  try{await work();}catch(e){setMessage(e instanceof Error?e.message:"Billing request failed");}
  finally{pending.current=false;setBusy(false);}
 }
 async function load(){
  const r=await api<{plans:Plan[]}>("/account/billing/plans");
  if(!r.ok)throw Error(r.error);
  if(!Array.isArray(r.data.plans))throw Error("Invalid plan response");
  setPlans(r.data.plans);
 }
 async function checkout(plan:string){
  let attempt=attempts.current.get(plan);
  if(!attempt){attempt=crypto.randomUUID();attempts.current.set(plan,attempt);}
  const r=await api<{url:string}>("/account/billing/checkout","POST",{plan,attempt});
  if(!r.ok)throw Error(r.error);
  const url=new URL(r.data.url);
  if(url.protocol!=="https:"||url.hostname!=="checkout.stripe.com"||url.username||url.password||url.port)throw Error("Invalid checkout destination");
  window.location.assign(url.href);
 }
 return <div>
  <button disabled={busy} onClick={()=>void run(load)}>View available plans</button>
  {plans?.length===0&&<p>No subscription plans are currently configured.</p>}
  {plans?.map(p=><div className="box" key={p.id}><b>{p.id}</b><p>Review the price and recurring payment terms on Stripe before purchase.</p><button disabled={busy} onClick={()=>void run(()=>checkout(p.id))}>Continue to checkout</button></div>)}
  {message&&<p role="status">{message}</p>}
 </div>;
}
