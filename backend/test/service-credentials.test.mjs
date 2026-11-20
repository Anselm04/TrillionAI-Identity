import test from "node:test";
import assert from "node:assert/strict";
import {issueServiceKey,digestServiceKey,matchesServiceKeyDigest,credentialIssueInput} from "../src/service-credentials.ts";

test("creates a unique 256-bit key and digest",()=>{
 const first=issueServiceKey(1000000,7);
 const second=issueServiceKey(1000000,7);
 assert.match(first.secret,/^tai_sk_[0-9a-f]{64}$/);
 assert.notEqual(first.secret,second.secret);
 assert.equal(first.digest.length,64);
 assert.equal(first.digest,digestServiceKey(first.secret));
 assert.equal(matchesServiceKeyDigest(first.secret,first.digest),true);
 assert.equal(matchesServiceKeyDigest(second.secret,first.digest),false);
});
test("rejects invalid keys and overly long lifetimes",()=>{
 assert.throws(()=>digestServiceKey("not-an-api-key"),/invalid_service_credential/);
 assert.throws(()=>issueServiceKey(Date.now(),91),/invalid_service_credential_expiry/);
 assert.equal(matchesServiceKeyDigest("bad","0".repeat(64)),false);
});
test("strict issuance schema accepts only scoped expiring keys",()=>{
 assert.equal(credentialIssueInput.safeParse({name:"worker"}).success,true);
 assert.equal(credentialIssueInput.safeParse({name:"worker",expires_in_days:91}).success,false);
 assert.equal(credentialIssueInput.safeParse({name:"worker",scopes:["identity:admin"]}).success,false);
 assert.equal(credentialIssueInput.safeParse({name:"worker",unexpected:true}).success,false);
});
