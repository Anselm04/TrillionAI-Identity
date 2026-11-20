import {useState} from "react";
import {api} from "./api";
export function OrganisationInvitations(){
 const [org,setOrg]=useState(""),[email,setEmail]=useState(""),[role,setRole]=useState("staff"),[token,setToken]=useState(""),[issued,setIssued]=useState<{id:string;token:string;expiresAt:string;org:string}|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function run(fn:()=>Promise<void>){if(busy)return;setBusy(true);setMessage("");try{await fn();}catch(e){setMessage(e instanceof Error?e.message:"Request failed");}finally{setBusy(false);}}
 return <section><h2>Organisation invitations</h2>
 <form onSubmit={e=>{e.preventDefault();void run(async()=>{setIssued(null);const r=await api<{id:string;token:string;expiresAt:string}>("/v1/organisations/"+encodeURIComponent(org.trim())+"/invitations","POST",{email:email.trim(),role});if(!r.ok)throw Error(r.error);setIssued({...r.data,org:org.trim()});setMessage("Invitation created. Share the code privately with the intended recipient.");});}}>
 <label>Organisation ID<input required value={org} onChange={e=>setOrg(e.target.value)}/></label>
 <label>Recipient email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Role<select value={role} onChange={e=>setRole(e.target.value)}><option value="staff">Staff</option><option value="customer">Customer</option><option value="admin">Admin</option></select></label>
 <button disabled={busy}>Create invitation</button></form>
 {issued&&<div><label>Private invitation code<input readOnly value={issued.token}/></label><p>Expires {new Date(issued.expiresAt).toLocaleString()}</p><button disabled={busy} onClick={()=>void run(async()=>{const r=await api("/v1/organisations/"+encodeURIComponent(issued.org)+"/invitations/"+encodeURIComponent(issued.id),"DELETE");if(!r.ok)throw Error(r.error);setIssued(null);setMessage("Invitation revoked.");})}>Revoke invitation</button><button onClick={()=>setIssued(null)}>Hide code</button></div>}
 <form onSubmit={e=>{e.preventDefault();void run(async()=>{const r=await api("/v1/invitations/accept","POST",{token:token.trim()});if(!r.ok)throw Error(r.error);setToken("");setMessage("Invitation accepted.");});}}><label>Invitation code<input required autoComplete="off" value={token} onChange={e=>setToken(e.target.value)}/></label><button disabled={busy}>Accept invitation</button></form>
 {message&&<p role="status">{message}</p>}</section>;
}
