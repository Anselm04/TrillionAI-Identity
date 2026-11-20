import { useState } from "react";
import { api } from "./api";
type AccountSession = {id:string;created_at:string;updated_at:string;current_session:boolean};
export function SessionInventory(){
  const [rows,setRows]=useState<AccountSession[]|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function load(){
    const result=await api<{sessions:AccountSession[]}>("/account/sessions");
    if(!result.ok){setRows(null);throw Error(result.error);}
    if(!Array.isArray(result.data.sessions)) {setRows(null);throw Error("Invalid session response");}
    setRows(result.data.sessions);
  }
  async function run(fn:()=>Promise<void>){
    if(busy)return;setBusy(true);setMessage("");
    try{await fn();}catch(e){setMessage(e instanceof Error?e.message:"Session request failed");}finally{setBusy(false);}
  }
  return <div>
    <button disabled={busy} onClick={()=>void run(load)}>View or refresh sessions</button>
    {message&&<p role="status">{message}</p>}
    {rows?.map(row=><div className="box" key={row.id}>
      <b>{row.current_session?"Current session":"Other session"}</b>
      <p>Created: {new Date(row.created_at).toLocaleString()}</p>
      {!row.current_session&&<button disabled={busy} onClick={()=>{if(window.confirm("Revoke this session?"))void run(async()=>{
        const result=await api("/account/sessions/"+encodeURIComponent(row.id),"DELETE");
        if(!result.ok)throw Error(result.error);
        setRows(previous=>previous?.filter(s=>s.id!==row.id)??null);
        setMessage("Session revoked.");
      });}}>Revoke session</button>}
    </div>)}
  </div>;
}
