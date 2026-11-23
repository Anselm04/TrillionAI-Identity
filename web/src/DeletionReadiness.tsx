import {useEffect, useRef, useState} from "react";
import {api} from "./api";
import {supabase} from "./supabase";
import {RequestGeneration} from "./request-generation";

type Readiness={
  ownershipConflicts:{id:string;name:string}[];
  billingConnected:boolean;
  storeAcknowledgementRequired:boolean|null;
  canRequestDeletion:boolean;
};
/** Readiness is advisory only; the backend rechecks all deletion conditions. */
export function DeletionReadiness(){
 const [value,setValue]=useState<Readiness|null>(null);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const generation=useRef(new RequestGeneration());
 const inFlight=useRef(false);

 useEffect(()=>{
   const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{
     if(event==="SIGNED_IN"||event==="SIGNED_OUT"){
       generation.current.invalidate();
       inFlight.current=false;
       setValue(null);setMessage("");setBusy(false);
     }
   });
   return ()=>{generation.current.invalidate();inFlight.current=false;subscription.unsubscribe();};
 },[]);

 async function check(){
   if(inFlight.current)return;
   inFlight.current=true;
   const ticket=generation.current.begin();
   setBusy(true);setMessage("");setValue(null);
   try{
     const r=await api<Readiness>("/account/deletion-readiness");
     if(!generation.current.isCurrent(ticket))return;
     if(!r.ok)throw Error(r.error);
     if(!Array.isArray(r.data.ownershipConflicts)||
         typeof r.data.billingConnected!=="boolean"||
         typeof r.data.canRequestDeletion!=="boolean")throw Error("Invalid deletion-readiness response");
     setValue(r.data);
   }catch(e){
     if(generation.current.isCurrent(ticket))
       setMessage(e instanceof Error?e.message:"Unable to check account");
   }finally{
     if(generation.current.isCurrent(ticket)){
       inFlight.current=false;
       setBusy(false);
     }
   }
 }
 return <div>
   <button disabled={busy} onClick={()=>void check()}>Check deletion requirements</button>
   {value&&<>
     <p>{value.canRequestDeletion?"You may request deletion. Billing cancellation and password confirmation will still be checked.":"Resolve the following requirements before deleting your account."}</p>
     {value.ownershipConflicts.map(o=><p key={o.id}>Transfer ownership of {o.name} ({o.id}).</p>)}
     {!value.billingConnected&&<p>Billing verification is unavailable.</p>}
     {value.storeAcknowledgementRequired&&<p>Cancel recurring subscriptions in the relevant app store.</p>}
   </>}
   {message&&<p role="status">{message}</p>}
 </div>;
}
