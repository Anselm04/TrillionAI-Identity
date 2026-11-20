import { ServiceCredentials } from "./ServiceCredentials";
import {useState} from "react";
import {api} from "./api";
type Org={id:string;name:string;role:string};
type Client={id:string;name:string;client_type:string;redirect_uris:string[];revoked_at:string|null};
export function DeveloperApplications(){
 const [orgs,setOrgs]=useState<Org[]>([]),[org,setOrg]=useState(""),[clients,setClients]=useState<Client[]>([]),[cursor,setCursor]=useState<string|null>(null);
 const [name,setName]=useState(""),[redirects,setRedirects]=useState(""),[kind,setKind]=useState("public"),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const path=(id:string)=>"/v1/organisations/"+encodeURIComponent(id)+"/clients";
 async function run(fn:()=>Promise<void>){if(busy)return;setBusy(true);setMessage("");try{await fn()}catch(e){setMessage(e instanceof Error?e.message:"Request failed")}finally{setBusy(false)}}
 async function load(id:string,after:string|null=null){const r=await api<{clients:Client[];next_cursor:string|null}>(path(id)+(after?"?after="+encodeURIComponent(after):""));if(!r.ok)throw Error(r.error);setClients(old=>after?[...old,...r.data.clients]:r.data.clients);setCursor(r.data.next_cursor)}
 return <section><h2>Developer applications</h2><p>Manage application registration metadata. OAuth sign-in is not yet available through this registry.</p>
 <button disabled={busy} onClick={()=>void run(async()=>{const r=await api<{organisations:Org[]}>("/v1/organisations");if(!r.ok)throw Error(r.error);setOrgs(r.data.organisations.filter(o=>["owner","admin"].includes(o.role)));setOrg("");setClients([]);setCursor(null)})}>Refresh organisations</button>
 <label>Organisation<select disabled={busy} value={org} onChange={e=>{const id=e.target.value;setOrg(id);setClients([]);setCursor(null);if(id)void run(()=>load(id))}}><option value="">Select organisation</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
 {org&&<><form onSubmit={e=>{e.preventDefault();void run(async()=>{const r=await api(path(org),"POST",{name:name.trim(),client_type:kind,redirect_uris:redirects.split(/\r?\n/).map(v=>v.trim()).filter(Boolean)});if(!r.ok)throw Error(r.error);setName("");setRedirects("");await load(org);setMessage("Application registered")})}}>
 <label>Application name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>Client type<select value={kind} onChange={e=>setKind(e.target.value)}><option value="public">Public</option><option value="confidential">Confidential</option></select></label>
 <label>HTTPS callback URLs (one per line)<textarea required value={redirects} onChange={e=>setRedirects(e.target.value)}/></label><button disabled={busy}>Register application</button></form>
 {clients.map(c=><div className="box" key={c.id}><h3>{c.name}</h3><p>Registry ID: {c.id}</p><p>{c.client_type} — {c.revoked_at?"Revoked":"Registered"}</p>{c.redirect_uris.map(uri=><p key={uri}>{uri}</p>)}{c.client_type==="confidential"&&!c.revoked_at&&<ServiceCredentials key={c.id} organisationId={org} clientId={c.id}/>}{!c.revoked_at&&<button disabled={busy} onClick={()=>{if(window.confirm("Revoke this application registration?"))void run(async()=>{const r=await api(path(org)+"/"+encodeURIComponent(c.id),"DELETE");if(!r.ok)throw Error(r.error);await load(org)})}}>Revoke registration</button>}</div>)}
 {cursor&&<button disabled={busy} onClick={()=>void run(()=>load(org,cursor))}>Load more</button>}</>}
 {message&&<p role="status">{message}</p>}</section>
}
