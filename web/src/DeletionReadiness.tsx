import {useState} from "react";
import {api} from "./api";
type Readiness={ownershipConflicts:{id:string;name:string}[];billingConnected:boolean;storeAcknowledgementRequired:boolean|null;canRequestDeletion:boolean};
export function DeletionReadiness(){
 const [value,setValue]=useState<Readiness|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function check(){setBusy(true);setMessage("");setValue(null);try{const r=await api<Readiness>("/account/deletion-readiness");if(!r.ok)throw Error(r.error);setValue(r.data);}catch(e){setMessage(e instanceof Error?e.message:"Unable to check account");}finally{setBusy(false);}}
 return <div><button disabled={busy} onClick={()=>void check()}>Check deletion requirements</button>{value&&<><p>{value.canRequestDeletion?"You may request deletion. Billing cancellation and password confirmation will still be checked.":"Resolve the following requirements before deleting your account."}</p>{value.ownershipConflicts.map(o=><p key={o.id}>Transfer ownership of {o.name} ({o.id}).</p>)}{!value.billingConnected&&<p>Billing verification is unavailable.</p>}{value.storeAcknowledgementRequired&&<p>Cancel recurring subscriptions in the relevant app store.</p>}</>}{message&&<p role="status">{message}</p>}</div>;
}
