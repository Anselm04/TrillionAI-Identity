import { useState } from "react";
import { api } from "./api";

type RecoveryCase = {
  user_id: string;
  requested_role: "customer" | "admin" | "owner";
  created_at: string;
};
type Page = { cases: RecoveryCase[]; nextCursor: string | null };

type Outcome = "identity_evidence_sighted" | "insufficient_evidence";
type EvidenceMethod = "in_person" | "verified_callback" | "verified_external_record";

function ReviewAttestation({caseId}:{caseId:string}) {
  const [outcome,setOutcome]=useState<Outcome>("insufficient_evidence");
  const [method,setMethod]=useState<EvidenceMethod>("in_person");
  const [digest,setDigest]=useState("");
  const [busy,setBusy]=useState(false);
  const [status,setStatus]=useState("");
  const [recorded,setRecorded]=useState(false);
  async function submit(event:React.FormEvent) {
    event.preventDefault();
    if (busy || recorded) return;
    if(!/^[a-f0-9]{64}$/.test(digest)){setStatus("Provide a 64-character lowercase SHA-256 reference fingerprint.");return;}
    setBusy(true);setStatus("");
    try {
      const result=await api<{recorded:boolean;authorizationGranted:boolean;mfaChanged:boolean}>(
        "/admin/mfa-recovery/requests/"+encodeURIComponent(caseId)+"/reviews","POST",
        {outcome,method,evidence_reference_sha256:digest});
      if(!result.ok){setStatus(result.error);return;}
      if(!result.data.recorded || result.data.authorizationGranted || result.data.mfaChanged){
        setStatus("Unexpected server review response. No reset requested.");return;
      }
      setDigest("");setRecorded(true);
      setStatus("Review attestation recorded. No account access or MFA permissions were changed.");
    } finally {setBusy(false);}
  }
  return <form onSubmit={e=>void submit(e)}>
    <p className="muted">Record only your own independently completed review. Never enter identity documents, passwords, OTP codes, or recovery tokens.</p>
    <label>Review outcome
      <select value={outcome} onChange={e=>setOutcome(e.target.value as Outcome)}>
        <option value="insufficient_evidence">Insufficient independent evidence</option>
        <option value="identity_evidence_sighted">Independent evidence sighted</option>
      </select>
    </label>
    <label>Verification category
      <select value={method} onChange={e=>setMethod(e.target.value as EvidenceMethod)}>
        <option value="in_person">In-person review</option>
        <option value="verified_callback">Verified callback</option>
        <option value="verified_external_record">Verified external record</option>
      </select>
    </label>
    <label>SHA-256 fingerprint of an independently retained evidence reference
      <input value={digest} onChange={e=>setDigest(e.target.value)} maxLength={64}
        pattern="[a-f0-9]{64}" autoComplete="off" required/>
    </label>
    <button disabled={busy||recorded}>Record review attestation (no unlock)</button>
    {status&&<p role="status">{status}</p>}
  </form>;
}

/** Reviewer queue is restricted by the API to privileged fresh-MFA sessions. */

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
      const url="/admin/mfa-recovery/requests?limit=25"+(after?"&after="+encodeURIComponent(after):"");
      const result=await api<Page>(url);
      if(!result.ok){setError(result.error);return;}
      setCases(result.data.cases);setCursor(after);setNextCursor(result.data.nextCursor);setLoaded(true);
    } finally {setBusy(false);}
  }
  return <section>
    <h2>Security: MFA recovery review</h2>
    <p className="muted">Reviewers can record an independently completed evidence attestation. This is not an account unlock or an MFA reset. A separately authorized recovery resolution process is still required.</p>
    <button disabled={busy} onClick={()=>void load()}>{loaded?"Refresh pending cases":"View pending cases"}</button>
    {error&&<p role="alert">{error}</p>}
    {loaded&&cases.length===0&&<p>No pending cases in this page.</p>}
    {cases.map(item=><div className="box" key={item.user_id}>
      <p><strong>Account:</strong> <code>{item.user_id}</code></p>
      <p>Role recorded at request: {item.requested_role}</p>
      <p>Requested: {new Date(item.created_at).toLocaleString()}</p>
      <ReviewAttestation caseId={item.user_id}/>
    </div>)}
    {loaded&&cursor!==null&&<button className="secondary" disabled={busy} onClick={()=>void load()}>First page</button>}
    {loaded&&nextCursor&&<button className="secondary" disabled={busy} onClick={()=>void load(nextCursor)}>Next page</button>}
  </section>;
}
