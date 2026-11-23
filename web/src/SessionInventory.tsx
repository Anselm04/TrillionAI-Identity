import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { supabase } from "./supabase";
import { RequestGeneration } from "./request-generation";

type AccountSession = {id:string;created_at:string;updated_at:string;current_session:boolean};

/**
 * Only the latest operation may update session rows. Authentication events
 * invalidate any in-flight work; Supabase Auth owns actual token refresh.
 */
export function SessionInventory(){
  const [rows,setRows]=useState<AccountSession[]|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const operations=useRef(new RequestGeneration());
  const running=useRef(false);

  useEffect(()=>{
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
      if(event==="SIGNED_OUT" || event==="SIGNED_IN"){
        operations.current.invalidate();
        running.current=false;
        setRows(null);
        setMessage("");
        setBusy(false);
      }
    });
    return ()=>{
      operations.current.invalidate();
      running.current=false;
      subscription.unsubscribe();
    };
  },[]);

  async function load(ticket:number){
    const result=await api<{sessions:AccountSession[]}>("/account/sessions");
    if(!operations.current.isCurrent(ticket))return;
    if(!result.ok){setRows(null);throw Error(result.error);}
    if(!Array.isArray(result.data.sessions)){
      setRows(null);throw Error("Invalid session response");
    }
    setRows(result.data.sessions);
  }
  async function run(fn:(ticket:number)=>Promise<void>){
    // useRef closes the same-tick double-click window before React renders.
    if(running.current)return;
    running.current=true;
    const ticket=operations.current.begin();
    setBusy(true);setMessage("");
    try{await fn(ticket);}
    catch(e){
      if(operations.current.isCurrent(ticket))
        setMessage(e instanceof Error?e.message:"Session request failed");
    }finally{
      if(operations.current.isCurrent(ticket)){
        running.current=false;
        setBusy(false);
      }
    }
  }

  return <div>
    <button disabled={busy} onClick={()=>void run(load)}>View or refresh sessions</button>
    {message&&<p role="status">{message}</p>}
    {rows?.map(row=><div className="box" key={row.id}>
      <b>{row.current_session?"Current session":"Other session"}</b>
      <p>Created: {new Date(row.created_at).toLocaleString()}</p>
      {!row.current_session&&<button disabled={busy} onClick={()=>{
        if(!window.confirm("Revoke this session?"))return;
        void run(async(ticket)=>{
          const result=await api("/account/sessions/"+encodeURIComponent(row.id),"DELETE");
          if(!operations.current.isCurrent(ticket))return;
          if(!result.ok)throw Error(result.error);
          setRows(previous=>previous?.filter(s=>s.id!==row.id)??null);
          setMessage("Session revoked.");
        });
      }}>Revoke session</button>}
    </div>)}
  </div>;
}
