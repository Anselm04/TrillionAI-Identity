import test from "node:test";
import assert from "node:assert/strict";
import { issueInvitation, invitationDigest, invitationTtlMs, mayInvite } from "../src/invitations.ts";
test("only active tenant owners and admins invite",()=>{
 for(const role of ["owner","admin","staff","customer","unknown"]) for(const status of ["active","suspended","invited"]) for(const target of ["owner","admin","staff","customer","unknown"]) {
  assert.equal(mayInvite(role,status,target),status==="active" && ((role==="owner" && ["admin","staff","customer"].includes(target)) || (role==="admin" && ["staff","customer"].includes(target))));
 }
});
test("invitation tokens are random and hashed, with bounded expiry",()=>{
 const a=issueInvitation(0),b=issueInvitation(0);
 assert.notEqual(a.token,b.token);assert.equal(a.token.length,43);
 assert.equal(a.digest,invitationDigest(a.token));assert.notEqual(a.token,a.digest);
 assert.equal(Date.parse(a.expiresAt),invitationTtlMs);
});
test("rejects malformed tokens",()=>{
 for(const token of ["","a".repeat(42),"a".repeat(44),"!".repeat(43)]) assert.throws(()=>invitationDigest(token));
});
