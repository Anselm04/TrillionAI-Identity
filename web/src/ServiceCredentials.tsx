import {useScopedOperation} from "./use-scoped-operation";
import {useState} from "react";
import {api} from "./api";

type Credential={id:string;name:string;secret_hint:string;scopes:string[];expires_at:string;revoked_at:string|null};
type Issued={id:string;name:string;secret:string;expires_at:string;one_time_display:true};
export function ServiceCredentials({organisationId,clientId}:{organisationId:string;clientId:string}){
 const [items,setItems]=useState<Credential[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [name,setName]=useState(""),[days,setDays]=useState(30),[issued,setIssued]=useState<Issued|null>(null);
 const {busy,message,run,current}=useScopedOperation(()=>{setItems([]);setCursor(null);setName("");setDays(30);setIssued(null);});
 const path="/v1/organisations/"+encodeURIComponent(organisationId)+"/clients/"+encodeURIComponent(clientId)+"/credentials";
 async function load(ticket:number,after:string|null=null){
  const result=await api<{credentials:Credential[];next_cursor:string|null}>(path+(after?"?after="+encodeURIComponent(after):""));
  if(!current(ticket))return;
  if(!result.ok)throw Error(result.error);
  setItems(previous=>after?[...previous,...result.data.credentials]:result.data.credentials);
  setCursor(result.data.next_cursor);
 }
 async function create(ticket:number){
  if(!name.trim())throw Error("Enter a credential name");
  const result=await api<Issued>(path,"POST",{name:name.trim(),expires_in_days:days,scopes:["identity:service:read"]});
  if(!current(ticket))return;
  if(!result.ok)throw Error(result.error);
  setIssued(result.data);setName("");
  await load(ticket);
 }
 async function revoke(ticket:number,id:string){
  const result=await api(path+"/"+encodeURIComponent(id),"DELETE");
  if(!current(ticket))return;
  if(!result.ok)throw Error(result.error);
  setIssued(null);await load(ticket);
 }
 return <section>
  <h4>Server-to-server credentials</h4>
  <p>Only for confidential server applications. These are opaque service keys, not OAuth client secrets or OAuth access tokens.</p>
  <button disabled={busy} onClick={()=>void run(ticket=>load(ticket))}>Load credentials</button>
  <form onSubmit={e=>{e.preventDefault();void run(create)}}>
   <label>Credential name<input value={name} required maxLength={100} disabled={busy} onChange={e=>setName(e.target.value)}/></label>
   <label>Expires after (days)<input type="number" min={1} max={90} value={days} disabled={busy} onChange={e=>setDays(Number(e.target.value))}/></label>
   <button disabled={busy}>Generate service credential</button>
  </form>
  {issued&&<div className="box" role="status">
   <p><strong>Copy this key now. It cannot be retrieved again.</strong> Store it only on a trusted server.</p>
   <label>One-time service credential<input readOnly value={issued.secret} autoComplete="off" spellCheck={false}/></label>
   <button onClick={()=>setIssued(null)}>I've saved the key — hide it</button>
  </div>}
  {items.map(item=><div className="box" key={item.id}>
   <p>{item.name} ({item.secret_hint}…)</p>
   <p>Expires: {new Date(item.expires_at).toLocaleString()} · {item.revoked_at?"Revoked":"Not revoked"}</p>
   {!item.revoked_at&&<button disabled={busy} onClick={()=>{if(window.confirm("Immediately revoke this credential?"))void run(ticket=>revoke(ticket,item.id))}}>Revoke credential</button>}
  </div>)}
  {cursor&&<button disabled={busy} onClick={()=>void run(ticket=>load(ticket,cursor))}>Load more credentials</button>}
  {message&&<p role="status">{message}</p>}
 </section>;
}
