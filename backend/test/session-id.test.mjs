import test from "node:test";
import assert from "node:assert/strict";
import { authenticatedSessionId } from "../src/session-id.ts";
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
