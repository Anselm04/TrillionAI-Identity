import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { beginAuthorization, exchangeCallback } from "../typescript/oauth.ts";
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
