import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { beginAuthorization, exchangeCallback, exchangeTrustedCallback, exchangeStoredCallback, beginStoredAuthorization } from "../typescript/oauth.ts";
if (!globalThis.crypto) Object.defineProperty(globalThis,"crypto",{value:webcrypto});
const issuer="https://example.supabase.co/auth/v1",redirectUri="https://app.example/callback";
test("creates S256 PKCE request with cryptographic state",async()=>{
 const {transaction,authorizationUrl}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const url=new URL(authorizationUrl);
 assert.equal(url.origin,"https://example.supabase.co");
 assert.equal(url.pathname,"/auth/v1/oauth/authorize");
 assert.equal(url.searchParams.get("response_type"),"code");
 assert.equal(url.searchParams.get("code_challenge_method"),"S256");
 assert.match(url.searchParams.get("code_challenge")??"",/^[A-Za-z0-9_-]{43}$/);
 assert.match(transaction.verifier,/^[A-Za-z0-9_-]{43}$/);
 assert.notEqual(transaction.state,transaction.verifier);
});
test("rejects state mismatch without contacting token endpoint",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"app",redirectUri});
 let sent=false;
 await assert.rejects(exchangeCallback({transaction,callbackUrl:redirectUri+"?code=abc&state=wrong",fetcher:async()=>{sent=true;throw Error("unexpected");}}),/oauth_state_mismatch/);
 assert.equal(sent,false);
});
test("exchanges valid callback using code verifier",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 let called=false;
 const tokens=await exchangeCallback({transaction,callbackUrl:redirectUri+"?code=short-code&state="+transaction.state,fetcher:async(input,init)=>{
   called=true;
   assert.equal(new URL(String(input)).pathname,"/auth/v1/oauth/token");
   const params=init?.body as URLSearchParams;
   assert.equal(params.get("grant_type"),"authorization_code");
   assert.equal(params.get("code_verifier"),transaction.verifier);
   assert.equal(params.get("redirect_uri"),redirectUri);
   return new Response(JSON.stringify({access_token:"access",refresh_token:"refresh",expires_in:3600,token_type:"bearer"}),{status:200,headers:{"Content-Type":"application/json"}});
 }});
 assert.equal(called,true);assert.equal(tokens.access_token,"access");
});
test("rejects expired requests and mismatched callback origins",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 await assert.rejects(exchangeCallback({transaction,callbackUrl:redirectUri+"?code=a&state="+transaction.state,now:transaction.createdAt+600001}),/expired/);
 await assert.rejects(exchangeCallback({transaction,callbackUrl:"https://evil.example/callback?code=a&state="+transaction.state}),/redirect_mismatch/);
});
test("rejects noncanonical or non-TLS callbacks",async()=>{
 await assert.rejects(beginAuthorization({issuer,clientId:"app",redirectUri:"http://evil.example/callback"}),/https_required/);
 await assert.rejects(beginAuthorization({issuer,clientId:"app",redirectUri:"https://app.example/callback#frag"}),/invalid_callback/);
});

test("rejects callback query pollution before token exchange",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const base=redirectUri+"?code=valid&state="+transaction.state;
 const invalid=[
  base+"&code=another",
  base+"&error=access_denied&error=other",
  base+"&error_description=first&error_description=second",
  base+"&unexpected=1",
 ];
 for(const callbackUrl of invalid){
  let called=false;
  await assert.rejects(exchangeCallback({transaction,callbackUrl,fetcher:async()=>{called=true;throw Error("unexpected_fetch");}}),
    /duplicate_oauth_parameter|unexpected_oauth_parameter|oauth_authorization_denied/);
  assert.equal(called,false);
 }
});

test("rejects fragment-bearing callback without token exchange",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 let called=false;
 await assert.rejects(exchangeCallback({transaction,callbackUrl:redirectUri+"?code=valid&state="+transaction.state+"#access_token=leak",fetcher:async()=>{called=true;throw Error("unexpected_fetch");}}),/redirect_mismatch/);
 assert.equal(called,false);
});
test("rejects registered OAuth protocol parameters",async()=>{
 const registeredRedirect="https://app.example/callback?state=preconfigured";
 // Registration must reject protocol-owned query keys before redirect.
 await assert.rejects(beginAuthorization({issuer,clientId:"public-app",redirectUri:registeredRedirect}),/invalid_registered_callback_parameter/);
 // A restored transaction may predate registration validation: exchange must
 // independently reject it without contacting the token endpoint.
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 let called=false;
 await assert.rejects(exchangeCallback({
  transaction:{...transaction,redirectUri:registeredRedirect},
  callbackUrl:registeredRedirect+"&code=valid&state="+transaction.state,
  fetcher:async()=>{called=true;throw Error("unexpected_fetch");}
 }),/invalid_registered_callback_parameter|redirect_mismatch/);
 assert.equal(called,false);
});

test("rejects simultaneous OAuth code and error before token exchange",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 let called=false;
 await assert.rejects(exchangeCallback({transaction,callbackUrl:redirectUri+"?code=valid&error=access_denied&state="+transaction.state,fetcher:async()=>{called=true;throw Error("unexpected_fetch");}}),/ambiguous_oauth_response/);
 assert.equal(called,false);
});

test("rejects tampered persisted PKCE transaction before token exchange",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 for (const changed of [
   {...transaction,verifier:"short"},
   {...transaction,state:"short"},
   {...transaction,clientId:"bad client"},
   {...transaction,redirectUri:"http://evil.example/callback"},
 ]) {
   let called=false;
   await assert.rejects(exchangeCallback({transaction:changed,callbackUrl,fetcher:async()=>{called=true;throw Error("unexpected_fetch");}}),/invalid_oauth_transaction|https_required/);
   assert.equal(called,false);
 }
});

test("rejects restored issuer or client substitution against trusted host configuration",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 for(const [changed,expected] of [
  [{...transaction,issuer:"https://attacker.example/auth/v1"},"oauth_issuer_mismatch"],
  [{...transaction,clientId:"attacker-app"},"oauth_client_mismatch"],
 ] as const){
  let called=false;
  await assert.rejects(exchangeCallback({
   transaction:changed,callbackUrl,expectedIssuer:issuer,expectedClientId:"public-app",
   fetcher:async()=>{called=true;throw Error("unexpected_fetch");}
  }),new RegExp(expected));
  assert.equal(called,false);
 }
});

test("rejects restored callback substitution against trusted host configuration",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const substituted="https://attacker.example/callback";
 let called=false;
 await assert.rejects(exchangeCallback({
  transaction:{...transaction,redirectUri:substituted},
  callbackUrl:substituted+"?code=valid&state="+transaction.state,
  expectedIssuer:issuer,expectedClientId:"public-app",expectedRedirectUri:redirectUri,
  fetcher:async()=>{called=true;throw Error("unexpected_fetch");}
 }),/oauth_redirect_mismatch/);
 assert.equal(called,false);
});

test("rejects reserved and duplicate registered callback parameters before authorization",async()=>{
 for(const redirect of [
  redirectUri+"?state=fixed",
  redirectUri+"?code=preloaded",
  redirectUri+"?error=access_denied",
  redirectUri+"?error_description=preloaded",
  redirectUri+"?error_uri=https%3A%2F%2Fexample.com",
 ]) {
  await assert.rejects(beginAuthorization({issuer,clientId:"public-app",redirectUri:redirect}),/invalid_registered_callback_parameter/);
 }
 await assert.rejects(beginAuthorization({
  issuer,clientId:"public-app",redirectUri:redirectUri+"?tenant=a&tenant=b"
 }),/duplicate_registered_callback_parameter/);
 const valid=await beginAuthorization({
  issuer,clientId:"public-app",redirectUri:redirectUri+"?tenant=a"
 });
 assert.equal(new URL(valid.authorizationUrl).searchParams.get("redirect_uri"),redirectUri+"?tenant=a");
});

test("binds registered callback query values and rejects substitution before token exchange",async()=>{
 const registered=redirectUri+"?tenant=trusted";
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri:registered});
 const valid=registered+"&code=valid&state="+transaction.state;
 let exchanges=0;
 const fetcher:typeof fetch=async()=>{
  exchanges++;
  return new Response(JSON.stringify({access_token:"access",refresh_token:"refresh",expires_in:3600,token_type:"bearer"}),{status:200});
 };
 for(const callbackUrl of [
  redirectUri+"?tenant=attacker&code=valid&state="+transaction.state,
  valid+"&tenant=attacker",
  redirectUri+"?code=valid&state="+transaction.state,
 ]){
  await assert.rejects(exchangeCallback({transaction,callbackUrl,fetcher}),/redirect_mismatch/);
 }
 assert.equal(exchanges,0);
 const result=await exchangeCallback({transaction,callbackUrl:valid,fetcher,expectedIssuer:issuer,expectedClientId:"public-app",expectedRedirectUri:registered});
 assert.equal(result.access_token,"access");
 assert.equal(exchanges,1);
});


test("rejects duplicate registered callback keys in restored transactions without exchange",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const duplicate=redirectUri+"?tenant=one&tenant=two";
 let called=false;
 await assert.rejects(exchangeCallback({
  transaction:{...transaction,redirectUri:duplicate},
  callbackUrl:duplicate+"&code=valid&state="+transaction.state,
  fetcher:async()=>{called=true;throw Error("unexpected_fetch");}
 }),/duplicate_registered_callback_parameter/);
 assert.equal(called,false);
});

test("rejects orphaned OAuth error metadata and empty errors before exchange",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 for(const query of [
  "code=valid&error_description=forged",
  "code=valid&error_uri=https%3A%2F%2Fexample.com",
  "error=",
 ]) {
  let called=false;
  await assert.rejects(exchangeCallback({
   transaction,callbackUrl:redirectUri+"?"+query+"&state="+transaction.state,
   fetcher:async()=>{called=true;throw Error("unexpected_fetch");}
  }),/orphan_oauth_error_metadata|invalid_oauth_error/);
  assert.equal(called,false);
 }
});

test("rejects non-finite callback clocks without token exchange",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 for(const now of [NaN,Infinity,-Infinity]){
  let called=false;
  await assert.rejects(exchangeCallback({
   transaction,callbackUrl,now,
   fetcher:async()=>{called=true;throw Error("unexpected_fetch");}
  }),/oauth_transaction_expired/);
  assert.equal(called,false);
 }
});

test("rejects non-string token types without object coercion",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 for(const token_type of [null,{},["bearer"],42,true]){
  await assert.rejects(exchangeCallback({
   transaction,callbackUrl,
   fetcher:async()=>new Response(JSON.stringify({
    access_token:"access",refresh_token:"refresh",expires_in:3600,token_type
   }),{status:200})
  }),/invalid_token_response/);
 }
});

test("rejects absent persisted OAuth transaction before any network request",async()=>{
 let called=false;
 await assert.rejects(exchangeCallback({
  transaction:null as unknown as Awaited<ReturnType<typeof beginAuthorization>>["transaction"],
  callbackUrl:redirectUri+"?code=valid&state=forged",
  fetcher:async()=>{called=true;throw Error("unexpected_fetch");}
 }),/invalid_oauth_transaction/);
 assert.equal(called,false);
});

test("rejects non-string restored transaction fields before token exchange",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 for(const changed of [
  {...transaction,state:42},
  {...transaction,verifier:[]},
  {...transaction,clientId:{toString:()=> "public-app"}},
  {...transaction,issuer:null},
  {...transaction,redirectUri:[]},
  {...transaction,createdAt:"0"},
 ]){
  let called=false;
  await assert.rejects(exchangeCallback({
   transaction:changed as unknown as typeof transaction,callbackUrl,
   fetcher:async()=>{called=true;throw Error("unexpected_fetch");}
  }),/invalid_oauth_transaction/);
  assert.equal(called,false);
 }
});

test("rejects empty OIDC ID token in successful token response",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 await assert.rejects(exchangeCallback({
  transaction,callbackUrl,
  fetcher:async()=>new Response(JSON.stringify({
   access_token:"access",refresh_token:"refresh",expires_in:3600,
   token_type:"bearer",id_token:""
  }),{status:200})
 }),/invalid_id_token/);
});

test("rejects fractional, unsafe and nonpositive OAuth token lifetimes",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 for(const expires_in of [0,-1,0.5,1.5,Number.MAX_SAFE_INTEGER+1]){
  await assert.rejects(exchangeCallback({
   transaction,callbackUrl,
   fetcher:async()=>new Response(JSON.stringify({
    access_token:"access",refresh_token:"refresh",expires_in,token_type:"bearer"
   }),{status:200})
  }),/invalid_token_response/);
 }
});


test("rejects malformed OAuth scope tokens before authorization",async()=>{
 for(const scope of ["", " ", "openid  email", " openid", "openid ", "openid\tprofile", "openid\nprofile", 'openid"other', "openid\\other", "openid\u007fother"]){
  await assert.rejects(beginAuthorization({issuer,clientId:"public-app",redirectUri,scope}),/invalid_oauth_scope/);
 }
 const {authorizationUrl}=await beginAuthorization({issuer,clientId:"public-app",redirectUri,scope:"openid email profile:read"});
 assert.equal(new URL(authorizationUrl).searchParams.get("scope"),"openid email profile:read");
});

test("rejects malformed issuer token response scopes",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 for(const scope of ["", "openid  email", " openid", "openid ", "openid\\tprofile", "openid\\nprofile", 'openid"other', "openid\\\\other", 42, null]){
  await assert.rejects(exchangeCallback({
   transaction,callbackUrl,
   fetcher:async()=>new Response(JSON.stringify({
    access_token:"access",refresh_token:"refresh",expires_in:3600,token_type:"bearer",scope
   }),{status:200})
  }),/invalid_scope/);
 }
 const tokens=await exchangeCallback({
  transaction,callbackUrl,
  fetcher:async()=>new Response(JSON.stringify({
   access_token:"access",refresh_token:"refresh",expires_in:3600,token_type:"bearer",scope:"openid email"
  }),{status:200})
 });
 assert.equal(tokens.scope,"openid email");
});

test("rejects invalid persisted timestamps and unsafe callback clocks before exchange",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 for(const createdAt of [-1,NaN,Infinity,-Infinity,1.5,Number.MAX_SAFE_INTEGER+1]){
  let called=false;
  await assert.rejects(exchangeCallback({
   transaction:{...transaction,createdAt},callbackUrl,
   fetcher:async()=>{called=true;throw Error("unexpected_fetch");}
  }),/invalid_oauth_transaction/);
  assert.equal(called,false);
 }
 for(const now of [-1,1.5,Number.MAX_SAFE_INTEGER+1]){
  let called=false;
  await assert.rejects(exchangeCallback({
   transaction,callbackUrl,now,
   fetcher:async()=>{called=true;throw Error("unexpected_fetch");}
  }),/oauth_transaction_expired/);
  assert.equal(called,false);
 }
});

test("trusted-registration callback helper rejects substituted issuer, client and redirect without fetch",async()=>{
 const registration={issuer,clientId:"public-app",redirectUri};
 const {transaction}=await beginAuthorization(registration);
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 for(const altered of [
  {...transaction,issuer:"https://attacker.example/auth/v1"},
  {...transaction,clientId:"attacker-client"},
  {...transaction,redirectUri:"https://attacker.example/callback"}
 ]){
  let called=false;
  await assert.rejects(exchangeTrustedCallback({
   registration,transaction:altered,callbackUrl,
   fetcher:async()=>{called=true;throw Error("unexpected_fetch");}
  }),/oauth_issuer_mismatch|oauth_client_mismatch|oauth_redirect_mismatch/);
  assert.equal(called,false);
 }
 let exchanges=0;
 const tokens=await exchangeTrustedCallback({
  registration,transaction,callbackUrl,
  fetcher:async()=>{
   exchanges++;
   return new Response(JSON.stringify({
    access_token:"access",refresh_token:"refresh",expires_in:3600,token_type:"bearer"
   }),{status:200});
  }
 });
 assert.equal(exchanges,1);
 assert.equal(tokens.access_token,"access");
});

test("trusted-registration callback helper rejects missing configuration without fetch",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 let called=false;
 await assert.rejects(exchangeTrustedCallback({
  registration:null as unknown as {issuer:string;clientId:string;redirectUri:string},
  transaction,callbackUrl:redirectUri+"?code=valid&state="+transaction.state,
  fetcher:async()=>{called=true;throw Error("unexpected_fetch");}
 }),/invalid_trusted_oauth_registration/);
 assert.equal(called,false);
});

test("rejects whitespace-only OAuth tokens returned by issuer",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 for(const override of [
  {access_token:"  "},
  {refresh_token:"\t"},
  {id_token:"  \n "}
 ]){
  await assert.rejects(exchangeCallback({
   transaction,callbackUrl,
   fetcher:async()=>new Response(JSON.stringify({
    access_token:"access",refresh_token:"refresh",expires_in:3600,token_type:"bearer",
    ...override
   }),{status:200})
  }),/invalid_token_response|invalid_id_token/);
 }
});

test("rejects blank or control-character authorization codes without token exchange",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 for(const code of ["", " ", "abc def", "abc\nxyz", "abc\txyz", "\u0000"]){
  let called=false;
  await assert.rejects(exchangeCallback({
   transaction,
   callbackUrl:redirectUri+"?code="+encodeURIComponent(code)+"&state="+transaction.state,
   fetcher:async()=>{called=true;throw Error("unexpected_fetch");}
  }),/invalid_authorization_code/);
  assert.equal(called,false);
 }
});

test("stored callback consumes transaction once and blocks replay", async () => {
 const registration={issuer,clientId:"public-app",redirectUri};
 const {transaction}=await beginAuthorization(registration);
 const entries=new Map([["oauth:tab",JSON.stringify(transaction)]]);
 const storage={
  getItem:(key:string)=>entries.get(key)??null,
  removeItem:(key:string)=>{entries.delete(key);}
 };
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 let requests=0;
 const fetcher:typeof fetch=async()=>{
  requests++;
  return new Response(JSON.stringify({
   access_token:"access",refresh_token:"refresh",expires_in:3600,token_type:"bearer"
  }),{status:200});
 };
 const result=await exchangeStoredCallback({
  registration,storage,storageKey:"oauth:tab",callbackUrl,fetcher
 });
 assert.equal(result.access_token,"access");
 assert.equal(entries.size,0);
 await assert.rejects(exchangeStoredCallback({
  registration,storage,storageKey:"oauth:tab",callbackUrl,fetcher
 }),/missing_oauth_transaction/);
 assert.equal(requests,1);
});

test("stored callback deletes malformed or tampered state before network I/O", async () => {
 const registration={issuer,clientId:"public-app",redirectUri};
 const {transaction}=await beginAuthorization(registration);
 for(const raw of ["{invalid",JSON.stringify({...transaction,issuer:"https://attacker.example/auth/v1"})]){
  const entries=new Map([["oauth:tab",raw]]);
  let requests=0;
  await assert.rejects(exchangeStoredCallback({
   registration,storage:{
    getItem:(key:string)=>entries.get(key)??null,
    removeItem:(key:string)=>{entries.delete(key);}
   },storageKey:"oauth:tab",
   callbackUrl:redirectUri+"?code=valid&state="+transaction.state,
   fetcher:async()=>{requests++;throw Error("unexpected_fetch");}
  }),/invalid_oauth_transaction|oauth_issuer_mismatch/);
  assert.equal(entries.size,0);
  assert.equal(requests,0);
 }
});

test("stored callback rejects oversized persisted transactions and consumes them", async () => {
 const registration={issuer,clientId:"public-app",redirectUri};
 const {transaction}=await beginAuthorization(registration);
 const entries=new Map([["oauth:tab",JSON.stringify(transaction)+" ".repeat(4097)]]);
 let requests=0;
 await assert.rejects(exchangeStoredCallback({
  registration,storage:{
   getItem:(key:string)=>entries.get(key)??null,
   removeItem:(key:string)=>{entries.delete(key);}
  },storageKey:"oauth:tab",
  callbackUrl:redirectUri+"?code=valid&state="+transaction.state,
  fetcher:async()=>{requests++;throw Error("unexpected_fetch");}
 }),/oauth_transaction_too_large/);
 assert.equal(entries.size,0);
 assert.equal(requests,0);
});

test("stored authorization persists PKCE before returning a redirect and refuses overwrite",async()=>{
 const records=new Map<string,string>();
 const storage={
  getItem:(key:string)=>records.get(key)??null,
  setItem:(key:string,value:string)=>{records.set(key,value);},
 };
 const registration={issuer,clientId:"public-app",redirectUri};
 const {authorizationUrl}=await beginStoredAuthorization({registration,storage,storageKey:"oauth:tab"});
 const transaction=JSON.parse(records.get("oauth:tab")!);
 assert.equal(new URL(authorizationUrl).searchParams.get("state"),transaction.state);
 await assert.rejects(beginStoredAuthorization({registration,storage,storageKey:"oauth:tab"}),/oauth_transaction_already_pending/);
 assert.equal(JSON.parse(records.get("oauth:tab")!).state,transaction.state);
});
test("stored authorization fails closed when browser storage rejects persistence",async()=>{
 const registration={issuer,clientId:"public-app",redirectUri};
 await assert.rejects(beginStoredAuthorization({
  registration,storage:{
   getItem:()=>null,
   setItem:()=>{throw Error("storage_quota_exceeded");},
  },storageKey:"oauth:tab"
 }),/storage_quota_exceeded/);
 await assert.rejects(beginStoredAuthorization({
  registration,storage:{getItem:()=>null,setItem:()=>{}},storageKey:""
 }),/invalid_oauth_storage/);
});

test("stored authorization rejects silently discarded or modified PKCE writes",async()=>{
 const registration={issuer,clientId:"public-app",redirectUri};
 for(const mode of ["discard","modify"]){
  let persisted:string|null=null;
  const storage={
   getItem:(_key:string)=>persisted,
   setItem:(_key:string,value:string)=>{
    if(mode==="modify") persisted=value+"corrupted";
   },
  };
  await assert.rejects(beginStoredAuthorization({
   registration,storage,storageKey:"oauth:tab"
  }),/oauth_transaction_not_persisted/);
 }
});


test("concurrent stored authorizations preserve the first pending PKCE transaction",async()=>{
 const registration={issuer,clientId:"public-app",redirectUri};
 const entries=new Map<string,string>();
 const storage={
  getItem:(key:string)=>entries.get(key)??null,
  setItem:(key:string,value:string)=>{entries.set(key,value);},
 };
 const results=await Promise.allSettled([
  beginStoredAuthorization({registration,storage,storageKey:"oauth:tab"}),
  beginStoredAuthorization({registration,storage,storageKey:"oauth:tab"}),
 ]);
 const fulfilled=results.filter(r=>r.status==="fulfilled");
 const rejected=results.filter(r=>r.status==="rejected");
 assert.equal(fulfilled.length,1);
 assert.equal(rejected.length,1);
 assert.match(String((rejected[0] as PromiseRejectedResult).reason),/oauth_transaction_already_pending/);
 const pending=JSON.parse(entries.get("oauth:tab")!);
 assert.equal(new URL((fulfilled[0] as PromiseFulfilledResult<{authorizationUrl:string}>).value.authorizationUrl).searchParams.get("state"),pending.state);
});


test("rejects oversized callback URLs and authorization codes without token exchange",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 let sent=false;
 const fetcher:typeof fetch=async()=>{sent=true;throw Error("unexpected_fetch");};
 await assert.rejects(exchangeCallback({
  transaction,callbackUrl:redirectUri+"?code="+("x".repeat(8192))+"&state="+transaction.state,fetcher
 }),/invalid_oauth_callback_size/);
 await assert.rejects(exchangeCallback({
  transaction,callbackUrl:redirectUri+"?code="+("x".repeat(4097))+"&state="+transaction.state,fetcher
 }),/invalid_authorization_code/);
 assert.equal(sent,false);
});

test("rejects whitespace and control characters inside bearer tokens",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 for(const token of ["abc def","abc\\tdef","abc\\ndef","abc\\u0000def","abc\\u007fdef"]){
  for(const field of ["access_token","refresh_token"] as const){
   await assert.rejects(exchangeCallback({
    transaction,callbackUrl,
    fetcher:async()=>new Response(JSON.stringify({
     access_token:"access",refresh_token:"refresh",expires_in:3600,token_type:"bearer",
     [field]:token
    }),{status:200})
   }),/invalid_token_response/);
  }
 }
});

test("rejects OIDC ID tokens containing whitespace or control bytes",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 for(const id_token of ["abc def","abc\\tdef","abc\\ndef","abc\\u0000def","abc\\u007fdef"]){
  await assert.rejects(exchangeCallback({
   transaction,callbackUrl,
   fetcher:async()=>new Response(JSON.stringify({
    access_token:"access",refresh_token:"refresh",expires_in:3600,
    token_type:"bearer",id_token
   }),{status:200})
  }),/invalid_id_token/);
 }
});

test("rejects oversized and malformed token responses without returning credentials",async()=>{
 const {transaction}=await beginAuthorization({issuer,clientId:"public-app",redirectUri});
 const callbackUrl=redirectUri+"?code=valid&state="+transaction.state;
 for(const body of ["x".repeat(65537),"{not-json"]){
  await assert.rejects(exchangeCallback({
   transaction,callbackUrl,
   fetcher:async()=>new Response(body,{status:200})
  }),/oauth_token_response_too_large|invalid_token_response/);
 }
 const valid=await exchangeCallback({
  transaction,callbackUrl,
  fetcher:async()=>new Response(JSON.stringify({
   access_token:"access",refresh_token:"refresh",expires_in:3600,token_type:"bearer"
  }),{status:200})
 });
 assert.equal(valid.access_token,"access");
});
