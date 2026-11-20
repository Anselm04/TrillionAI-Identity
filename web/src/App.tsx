import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { api } from "./api";
import { SignUpForm } from "./vendor/supabase/sign-up-form";
import { LoginForm } from "./vendor/supabase/login-form";
import { UpdatePasswordForm } from "./vendor/supabase/update-password-form";
import { safeNextPath } from "./vendor/supabase/safe-next-path";
type Profile = { id:string; email:string; role:string; mfa_enabled:boolean };
type Subscription = {id:string;plan:string;amountLabel:string;status:string;renewsAt:string|null;accessUntil:string|null;store:string;manageUrl?:string};
function Field({label,type="text",value,onChange}:{label:string;type?:string;value:string;onChange:(value:string)=>void}) {
  return <label>{label}<input type={type} value={value} onChange={e=>onChange(e.target.value)} required/></label>;
}
export default function App(){
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  const [page,setPage]=useState<"login"|"signup"|"forgot"|"resend">("login");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [currentPassword,setCurrentPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [code,setCode]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [mode,setMode]=useState<"normal"|"recover">("normal");
  const [profile,setProfile]=useState<Profile|null>(null);
  const [factor,setFactor]=useState<string|null>(null);
  const [mfaPending,setMfaPending]=useState(false);
  const [enrolling,setEnrolling]=useState<{id:string;qr:string;secret:string}|null>(null);
  const [subscriptions,setSubscriptions]=useState<Subscription[]|null>(null);
  const [name,setName]=useState("");
  useEffect(()=>{
    let active=true;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,current)=>{
      if(!active)return;
      setSession(current);
      if(event==="PASSWORD_RECOVERY")setMode("recover");
      if(event==="SIGNED_OUT"){setProfile(null);setFactor(null);setMfaPending(false);setSubscriptions(null);setEnrolling(null);setName("");setCode("");setPassword("");setCurrentPassword("");setConfirm("");setMode("normal");}
    });
    void supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setReady(true);}});
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);
  async function reload(){
    setMessage("");
    const [me, aal, factors]=await Promise.all([
      api<Profile|{mfa_required:true;mfa_factor_id:string}>("/me"),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors()
    ]);
    if(!me.ok){setProfile(null);setMessage(me.error);return;}
    if(aal.error || factors.error){setProfile(null);setMessage("Account security check unavailable. Please retry.");return;}
    const factorId = factors.data?.totp.find(f=>f.status==="verified")?.id ?? null;
    setFactor(factorId);
    const pending=Boolean(factorId && aal.data?.currentLevel!=="aal2");
    setMfaPending(pending);
    if(pending){setProfile(null);return;}
    if("mfa_required" in me.data){setMfaPending(true);return;}
    setProfile(me.data);
    const next = new URLSearchParams(window.location.search).get("next");
    if(next && window.location.pathname === "/") {
      const destination = safeNextPath(next, "/", window.location.origin);
      if(destination !== "/" && destination !== window.location.pathname + window.location.search + window.location.hash) window.location.replace(destination);
    }
  }
  useEffect(()=>{if(session?.access_token && mode!=="recover"){void reload();}},[session?.access_token,mode]);
  async function submit(fn:()=>Promise<void>){setBusy(true);setMessage("");try{await fn();}catch(e){setMessage(e instanceof Error?e.message:"Request failed");}finally{setBusy(false);}}
  async function requestEmail(e:FormEvent){e.preventDefault();await submit(async()=>{
    const address=email.trim();
    if(page==="forgot"){
      const {error}=await supabase.auth.resetPasswordForEmail(address,{
        redirectTo:window.location.origin+"/reset",
      });
      if(error && error.status!==404)throw Error(error.message);
    }else{
      const {error}=await supabase.auth.resend({
        email:address,type:"signup",options:{emailRedirectTo:window.location.origin+"/verified"},
      });
      if(error && error.status!==404)throw Error(error.message);
    }
    setMessage("If this address is eligible, an email has been requested.");
  });}
  async function signOut(scope:"local"|"global"|"others"="local"){await submit(async()=>{
    const {error}=await supabase.auth.signOut({scope});
    if(error)throw Error(error.message);
    if(scope==="others"){setMessage("Other sessions signed out. This session remains active.");return;}
    setProfile(null);
  });}
  async function verifyMfa(e:FormEvent){e.preventDefault();if(!factor)return;await submit(async()=>{
    const {error}=await supabase.auth.mfa.challengeAndVerify({factorId:factor,code:code.trim()});
    if(error)throw Error(error.message);
    setCode("");setEnrolling(null);await reload();
  });}
  async function verifyOwnerStepUp(e:FormEvent){e.preventDefault();await submit(async()=>{
    if(!factor)throw Error("Enroll an authenticator before owner access");
    const {error}=await supabase.auth.mfa.challengeAndVerify({factorId:factor,code:code.trim()});
    if(error)throw Error(error.message);
    setCode("");
    const approved=await api<{ok:boolean}>("/owner/ping");
    if(!approved.ok)throw Error(approved.error);
    setMessage("Owner MFA verified. Server-side privileged access is active for this session.");
  });}
  async function setupMfa(){await submit(async()=>{
    const {data,error}=await supabase.auth.mfa.enroll({factorType:"totp",friendlyName:"TrillionAI authenticator"});
    if(error)throw Error(error.message);
    if(!data.totp?.qr_code || !data.totp.secret)throw Error("Authenticator setup did not return enrollment details");
    setEnrolling({id:data.id,qr:data.totp.qr_code,secret:data.totp.secret});
  });}
  async function confirmMfa(e:FormEvent){e.preventDefault();if(!enrolling)return;await submit(async()=>{
    const {error}=await supabase.auth.mfa.challengeAndVerify({factorId:enrolling.id,code:code.trim()});
    if(error)throw Error(error.message);
    setCode("");setEnrolling(null);await reload();
  });}
  async function updatePassword(e:FormEvent){e.preventDefault();await submit(async()=>{
    if(password.length<12||password.length>128||password!==confirm)throw Error("New passwords must match and be at least 12 characters");
    {
      if(!currentPassword)throw Error("Enter your current password");
      const r=await api<{updated:boolean}>("/auth/change-password","POST",{
        current_password:currentPassword,new_password:password,
      });
      if(!r.ok)throw Error(r.error);
      await supabase.auth.signOut({scope:"local"});
    }
    setCurrentPassword("");setMode("normal");setPassword("");setConfirm("");
    setMessage("Password updated. Sign in again with the new password.");
  });}
  async function cancelSubscription(s:Subscription){
    await submit(async()=>{
      const r=await api<{cancelled:boolean;accessUntil:string|null}>(`/account/subscriptions/${encodeURIComponent(s.id)}/cancel`,"POST");
      if(!r.ok)throw Error(r.error);
      setMessage("Cancellation confirmed. Access until "+(r.data.accessUntil??"end of current period"));
      await loadSubscriptions();
    });
  }
  async function loadSubscriptions(){
    const r=await api<{subscriptions:Subscription[]}>("/account/subscriptions");
    if(r.ok)setSubscriptions(r.data.subscriptions);else setMessage(r.error);
  }
  async function exportData(){await submit(async()=>{
    const r=await api<Record<string,unknown>>("/account/export");
    if(!r.ok)throw Error(r.error);
    const url=URL.createObjectURL(new Blob([JSON.stringify(r.data,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="trillionai-my-data.json";a.click();
    URL.revokeObjectURL(url);
  });}
  async function deleteAccount(){
    if(!window.confirm("Permanently delete your account? This cannot be undone."))return;
    const typed=window.prompt('Type DELETE to confirm');
    if(typed!=="DELETE")return;
    const pw=window.prompt("Enter your current password to authorize deletion");
    if(!pw)return;
    await submit(async()=>{
      let r=await api<{deleted:boolean}>("/account","DELETE",{password:pw,confirm:"DELETE"});
      if(!r.ok && r.status===409 && r.error==="store_subscription_needs_cancellation"){
        const detail=r.data as {manageUrls?:string[]}|undefined;
        const urls=(detail?.manageUrls??[]).filter(Boolean).join("\\n");
        const acknowledged=window.confirm("You have an Apple/Google subscription. Deleting this account does NOT stop its billing. Cancel it in the relevant app store.\\n" + urls + "\\n\\nDelete the account anyway?");
        if(!acknowledged)return;
        r=await api<{deleted:boolean}>("/account","DELETE",{password:pw,confirm:"DELETE",acknowledge_store_subscriptions:true});
      }
      if(!r.ok)throw Error(r.error);
      await supabase.auth.signOut({scope:"local"});
      setProfile(null);setMessage("Account deletion confirmed.");
    });
  }
  if(!ready)return <main aria-busy="true">Checking session…</main>;
  if(window.location.pathname==="/verified" && !session)return <main><h1>Verify your email</h1><p>Your verification link is being processed. If confirmation succeeds, sign in. Otherwise request a new link.</p><a href="/">Back to sign in</a></main>;
  return <main>
    <h1>TrillionAI Identity</h1>
    <p className="muted">Secure account registration, verification and management</p>
    {message && <p role="status" className={message.includes("confirmed")?"good":"error"}>{message}</p>}
    {mode==="recover" && session ? <UpdatePasswordForm onComplete={()=>{setMode("normal");setPage("login");setMessage("Password updated. Sign in again with your new password.");}}/>:
    !session?<><nav className="tabs">{(["login","signup","forgot","resend"] as const).map(k=><button className={page===k?"":"secondary"} key={k} onClick={()=>{setPage(k);setMessage("");}}>{ {login:"Sign in",signup:"Create account",forgot:"Forgot password",resend:"Resend verification"}[k]}</button>)}</nav>
      {page==="signup"?<SignUpForm onSignIn={()=>{setPage("login");setMessage("");}}/>:page==="login"?<LoginForm onForgot={()=>{setPage("forgot");setMessage("");}} onSignUp={()=>{setPage("signup");setMessage("");}}/>:<form onSubmit={requestEmail}>
      <Field label="Email" type="email" value={email} onChange={setEmail}/>
      <button disabled={busy}>{ {login:"Sign in",signup:"Create account",forgot:"Send recovery link",resend:"Resend email"}[page]}</button></form>}
    </>:
    mfaPending?<section><h2>Two-step verification required</h2><form onSubmit={verifyMfa}>
      <Field label="Six-digit authenticator code" value={code} onChange={setCode}/>
      <button disabled={busy}>Verify</button></form><button className="secondary" onClick={()=>void signOut()}>Sign out</button></section>:
    !profile?<section><p role="status">Checking verified account access.</p><button onClick={()=>void reload()}>Retry</button><button className="secondary" onClick={()=>void signOut()}>Sign out</button></section>:
    <><p>Signed in as {session.user.email}</p><button className="secondary" onClick={()=>void signOut()}>Sign out</button>
      <section><h2>Session management</h2>
        <button disabled={busy} onClick={()=>{if(window.confirm("Sign out all other devices?"))void signOut("others");}}>Sign out other devices</button>
        <button disabled={busy} onClick={()=>{if(window.confirm("Sign out every device, including this one?"))void signOut("global");}}>Sign out all devices</button>
        <p className="muted">Revoked devices cannot refresh their sessions. Existing access tokens may remain valid until expiry.</p>
      </section>
      <section><h2>Account security</h2><p>Role: {profile?.role ?? "customer"}</p>
        {!factor && !enrolling && <button onClick={setupMfa}>Enable authenticator MFA</button>}
        {enrolling && <form onSubmit={confirmMfa}><p>Scan this QR code in your authenticator app or enter the key:</p>
          <img className="qr" src={enrolling.qr} alt="MFA enrollment QR"/><p><code>{enrolling.secret}</code></p>
          <Field label="Six-digit code" value={code} onChange={setCode}/><button disabled={busy}>Confirm MFA</button></form>}
        {factor&&<p className="good">Authenticator MFA enrolled</p>}
        <p className="muted">Only the server can assign owner permissions.</p></section>
      {profile?.role==="owner"&&<section><h2>Private owner verification</h2>
        <p>The server requires a fresh authenticator challenge for privileged operations.</p>
        <form onSubmit={verifyOwnerStepUp}>
          <Field label="Fresh six-digit code" value={code} onChange={setCode}/>
          <button disabled={busy}>Verify private owner access</button>
        </form>
      </section>}
      <section><h2>Profile</h2><Field label="Display name" value={name} onChange={setName}/>
        <button onClick={()=>submit(async()=>{const r=await api("/account/profile","PATCH",{display_name:name});if(!r.ok)throw Error(r.error);setMessage("Profile saved");})}>Save profile</button></section>
      <section><h2>Change email</h2><p>New email must be verified.</p>
        <button onClick={()=>submit(async()=>{
          const next=window.prompt("New email");if(!next)return;
          const {error}=await supabase.auth.updateUser({email:next},{emailRedirectTo:window.location.origin+"/verified"});
          if(error)throw Error(error.message);setMessage("Check verification emails to complete change.");
        })}>Change email</button></section>
      <section><h2>Change password</h2><form onSubmit={updatePassword}>
        <Field label="Current password" type="password" value={currentPassword} onChange={setCurrentPassword}/>
        <Field label="New password (12+ characters)" type="password" value={password} onChange={setPassword}/>
        <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm}/>
        <button disabled={busy}>Update password</button></form></section>
      <section><h2>Subscription management</h2><button onClick={loadSubscriptions}>View subscriptions</button>
        {subscriptions?.length===0&&<p>No subscriptions reported.</p>}
        {subscriptions?.map(s=><div key={s.id} className="box"><b>{s.plan}</b> — {s.amountLabel}<p>{s.status==="cancelled"?"Cancelled":"Renews "+(s.renewsAt??"unknown")}</p>
          {s.status!=="cancelled"&&(s.store==="direct"?<button onClick={()=>cancelSubscription(s)}>Cancel subscription</button>:<p>Manage through {s.store}: {s.manageUrl&&<a href={s.manageUrl}>Subscription settings</a>}</p>)}</div>)}</section>
      <section><h2>Your data</h2><button onClick={exportData}>Export data</button></section>
      <section><h2>Delete account</h2><p>Permanent deletion must first verify that connected subscriptions are cancelled and product data is removed.</p>
        <button className="danger" onClick={deleteAccount}>Delete my account</button></section>
    </>}
  </main>;
}
