import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import { AccountOperationGate } from "./account-operation-gate";

// UI isolation only: server-side authorization remains authoritative.
export function useScopedOperation(reset:()=>void){
 const gate=useRef(new AccountOperationGate());
 const resetRef=useRef(reset);
 resetRef.current=reset;
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 function invalidate(){gate.current.invalidate();setBusy(false);setMessage("");resetRef.current();}
 useEffect(()=>{
  const {data:{subscription}}=supabase.auth.onAuthStateChange(event=>{
   if(event==="SIGNED_IN"||event==="SIGNED_OUT")invalidate();
  });
  return ()=>{gate.current.invalidate();subscription.unsubscribe();};
 },[]);
 const current=(ticket:number)=>gate.current.current(ticket);
 async function run(work:(ticket:number)=>Promise<void>){
  const ticket=gate.current.begin();if(ticket===null)return;
  setBusy(true);setMessage("");
  try{await work(ticket);}
  catch(e){if(current(ticket))setMessage(e instanceof Error?e.message:"Request failed");}
  finally{if(gate.current.finish(ticket))setBusy(false);}
 }
 return {busy,message,setMessage,run,current,invalidate};
}
