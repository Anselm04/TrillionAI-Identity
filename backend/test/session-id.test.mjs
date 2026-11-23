import test from "node:test";
import assert from "node:assert/strict";
import { authenticatedSessionId, authenticatedSessionAssurance } from "../src/session-id.ts";
const uid="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const sid="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const token=claims=>"header."+Buffer.from(JSON.stringify(claims)).toString("base64url")+".signature";
test("extracts session only for the already authenticated subject",()=>assert.equal(authenticatedSessionId(token({sub:uid,session_id:sid}),uid),sid));
test("rejects different subject",()=>assert.equal(authenticatedSessionId(token({sub:"other",session_id:sid}),uid),null));
test("rejects missing or invalid session identifiers",()=>{
 for(const session_id of [undefined,null,42,"bad",{},[]]) assert.equal(authenticatedSessionId(token({sub:uid,session_id}),uid),null);
});
test("rejects malformed claims and token shape",()=>{
 for(const value of ["", "a.b", "a.!.c","a.b.c.d", token(null)]) assert.equal(authenticatedSessionId(value,uid),null);
});

test("accepts issuer-signed assurance claims only after caller has verified bearer",()=>{
 const methods=[{method:"password",timestamp:1800000000},{method:"totp",timestamp:1800000010}];
 assert.deepEqual(authenticatedSessionAssurance(token({sub:uid,aal:"aal2",amr:methods}),uid),{aal:"aal2",methods});
 assert.deepEqual(authenticatedSessionAssurance(token({sub:uid,aal:"aal1",amr:[]}),uid),{aal:"aal1",methods:[]});
});
test("rejects malformed assurance, subject mismatch and forged step-up structures",()=>{
 const valid={sub:uid,aal:"aal2",amr:[{method:"totp",timestamp:1800000010}]};
 for(const claims of [
  {...valid,sub:"other"}, {...valid,aal:"aal3"}, {...valid,aal:null},
  {...valid,amr:null}, {...valid,amr:{}}, {...valid,amr:[null]},
  {...valid,amr:["totp"]}, {...valid,amr:Array(33).fill({})},
 ]) assert.equal(authenticatedSessionAssurance(token(claims),uid),null);
 assert.equal(authenticatedSessionAssurance("invalid",uid),null);
});
