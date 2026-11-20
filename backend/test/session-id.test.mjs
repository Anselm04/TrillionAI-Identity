import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validatedSessionId} from '../src/session-id.ts';

const uid='a1111111-1111-4111-8111-111111111111';
const sid='b2222222-2222-4222-8222-222222222222';
const jwt=(claims)=>'e30.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';

test('extracts the session of the provider-validated subject',()=>{
  assert.equal(validatedSessionId(jwt({sub:uid,session_id:sid}),uid),sid);
});
test('rejects cross-account subject',()=>{
  assert.equal(validatedSessionId(jwt({sub:'different',session_id:sid}),uid),null);
});
test('rejects missing and malformed session identifiers',()=>{
  for(const value of [undefined,null,123,'not-a-uuid','../session','']) {
    assert.equal(validatedSessionId(jwt({sub:uid,session_id:value}),uid),null);
  }
});
test('rejects malformed payloads without throwing',()=>{
  for(const token of ['', 'a.b','a.!!!!.c',jwt(null),jwt([]),jwt('string')]) {
    assert.equal(validatedSessionId(token,uid),null);
  }
});

test('rejects incomplete and oversized bearer tokens',()=>{
  const payload=Buffer.from(JSON.stringify({sub:uid,session_id:sid})).toString('base64url');
  for(const token of ['.'+payload+'.signature','e30.'+payload+'.','e30.'+payload+'.'+'a'.repeat(32768)]) {
    assert.equal(validatedSessionId(token,uid),null);
  }
});
