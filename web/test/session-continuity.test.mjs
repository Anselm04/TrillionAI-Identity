import test from "node:test";
import assert from "node:assert/strict";
import { clientSessionId, sameClientSession } from "../src/session-continuity.ts";
const user="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const different="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const id="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const other="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const jwt=(session_id,extra={})=>"eyJhbGciOiJIUzI1NiJ9."+Buffer.from(JSON.stringify({session_id,...extra})).toString("base64url")+".signature";
const snap=(u,s,extra={})=>({user:{id:u},access_token:jwt(s,extra)});
test("retains same provider session across a token rotation",()=>{
 assert.equal(sameClientSession(snap(user,id),snap(user,id,{iat:200,aal:"aal2"})),true);
});
test("drops signed-out, switched-user and new-login response data",()=>{
 assert.equal(sameClientSession(snap(user,id),null),false);
 assert.equal(sameClientSession(snap(user,id),snap(different,id)),false);
 assert.equal(sameClientSession(snap(user,id),snap(user,other)),false);
});
test("rejects malformed or sessionless tokens without falling back to user only",()=>{
 assert.equal(clientSessionId("bad"),null);
 assert.equal(sameClientSession(snap(user,id),{user:{id:user},access_token:jwt("invalid")}),false);
 assert.equal(sameClientSession(snap(user,id),{user:{id:user},access_token:"bad"}),false);
});
