import { useState } from "react";
import { api } from "./api";

type RecoveryCase = {
  user_id: string;
  requested_role: "customer" | "admin" | "owner";
  created_at: string;
};
type Page = { cases: RecoveryCase[]; nextCursor: string | null };

/** Read-only review. No mechanism here can approve or reset MFA. */
export function RecoveryReview() {
  const [cases,setCases]=useState<RecoveryCase[]>([]);
  const [cursor,setCursor]=useState<string|null>(null);
  const [nextCursor,setNextCursor]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [loaded,setLoaded]=useState(false);
  async function load(after:string|null=null) {
    if (busy) return;
    setBusy(true);setError("");
    try {
      const url="/owner/mfa-recovery/requests?limit=25"+(after?"&after="+encodeURIComponent(after):"");
      const result=await api<Page>(url);
      if(!result.ok){setError(result.error);return;}
      setCases(result.data.cases);setCursor(after);setNextCursor(result.data.nextCursor);setLoaded(true);
    } finally {setBusy(false);}
  }
  return <section>
    <h2>Owner security: MFA recovery review</h2>
    <p className="muted">This is a read-only queue. Reviewing a case cannot reset MFA or restore account access. Any lost-all-factors recovery needs a separately approved procedure.</p>
    <button disabled={busy} onClick={()=>void load()}>{loaded?"Refresh pending cases":"View pending cases"}</button>
    {error&&<p role="alert">{error}</p>}
    {loaded&&cases.length===0&&<p>No pending cases in this page.</p>}
    {cases.map(item=><div className="box" key={item.user_id}>
      <p><strong>Account:</strong> <code>{item.user_id}</code></p>
      <p>Role recorded at request: {item.requested_role}</p>
      <p>Requested: {new Date(item.created_at).toLocaleString()}</p>
    </div>)}
    {loaded&&cursor!==null&&<button className="secondary" disabled={busy} onClick={()=>void load()}>First page</button>}
    {loaded&&nextCursor&&<button className="secondary" disabled={busy} onClick={()=>void load(nextCursor)}>Next page</button>}
  </section>;
}
