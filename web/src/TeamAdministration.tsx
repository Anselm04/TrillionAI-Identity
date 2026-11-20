import { useState } from "react";
import { api } from "./api";
type Org={id:string;name:string;role:string};
type Member={user_id:string;role:string;status:string};
export function TeamAdministration(){
 const [orgs,setOrgs]=useState<Org[]>([]),[selected,setSelected]=useState<Org|null>(null),[members,setMembers]=useState<Member[]>([]),[cursor,setCursor]=useState<string|null>(null),[name,setName]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setMessage("");try{await work();}catch(e){setMessage(e instanceof Error?e.message:"Request failed");}finally{setBusy(false);}}
 async function loadOrgs(){const r=await api<{organisations:Org[]}>("/v1/organisations");if(!r.ok)throw Error(r.error);setOrgs(r.data.organisations);}
 async function loadMembers(org:Org,after:string|null=null){const r=await api<{members:Member[];next_cursor:string|null}>("/v1/organisations/"+encodeURIComponent(org.id)+"/members"+(after?"?after="+encodeURIComponent(after):""));if(!r.ok)throw Error(r.error);setMembers(old=>after?[...old,...r.data.members]:r.data.members);setCursor(r.data.next_cursor);}
 async function change(m:Member,role:string,status:string,remove=false){if(!selected)return;const org=selected;const r=await api("/v1/organisations/"+encodeURIComponent(org.id)+"/members/"+encodeURIComponent(m.user_id),remove?"DELETE":"PATCH",remove?undefined:{role,status});if(!r.ok)throw Error(r.error);setMembers([]);setCursor(null);await loadMembers(org);}
 return <section><h2>Team administration</h2>
 <form onSubmit={e=>{e.preventDefault();void run(async()=>{const r=await api("/v1/organisations","POST",{name:name.trim()});if(!r.ok)throw Error(r.error);setName("");await loadOrgs();});}}><label>New organisation name<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)}/></label><button disabled={busy}>Create organisation</button></form>
 <button disabled={busy} onClick={()=>void run(loadOrgs)}>Refresh organisations</button>
 <label>Organisation<select disabled={busy} value={selected?.id??""} onChange={e=>{const org=orgs.find(o=>o.id===e.target.value)??null;setSelected(org);setMembers([]);setCursor(null);if(org&&org.role!=="customer")void run(()=>loadMembers(org));}}><option value="">Select organisation</option>{orgs.map(o=><option key={o.id} value={o.id}>{o.name} ({o.role})</option>)}</select></label>
 {selected&&<p>Organisation ID: {selected.id}</p>}
 {selected&&members.map(m=>{const manage=selected.role==="owner"||(selected.role==="admin"&&["staff","customer"].includes(m.role));return <div key={m.user_id} className="box"><p>{m.user_id} — {m.role} — {m.status}</p>{manage&&m.status!=="invited"&&<><label>Role<select disabled={busy} value={m.role} onChange={e=>{const role=e.target.value;if(window.confirm("Change member role?"))void run(()=>change(m,role,m.status));}}>{(selected.role==="owner"?["owner","admin","staff","customer"]:["staff","customer"]).map(r=><option key={r}>{r}</option>)}</select></label><button disabled={busy} onClick={()=>void run(()=>change(m,m.role,m.status==="active"?"suspended":"active"))}>{m.status==="active"?"Suspend":"Reactivate"}</button></>}{manage&&<button disabled={busy} onClick={()=>{if(window.confirm("Remove this member?"))void run(()=>change(m,m.role,m.status,true));}}>Remove</button>}</div>;})}
 {selected&&cursor&&<button disabled={busy} onClick={()=>void run(()=>loadMembers(selected,cursor))}>Load more members</button>}
 {message&&<p role="status">{message}</p>}</section>;
}
