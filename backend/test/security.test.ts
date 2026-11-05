import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hasPermission } from '../src/authorisation.js';
import type { IdentityStore } from '../src/db.js';

const orgA = '11111111-1111-4111-8111-111111111111';
const orgB = '22222222-2222-4222-8222-222222222222';
const store: IdentityStore = {
  async membership(org, sub) {
    return org === orgA && sub === 'user-a' ? { organisation_id: org, subject: sub, role: 'staff' } : null;
  },
  async organisation(id) { return id === orgA ? {id, name: 'Alpha'} : {id, name: 'Beta'}; },
  async listOrganisations(sub) { return sub === 'user-a' ? [{id:orgA,name:'Alpha',role:'staff'}] : []; },
  async close() {}
};
test('security: missing or invalid bearer token is denied', async () => {
  const app = await createApp({store, verifier:{async verify(t){if(t!=='good')throw Error('bad');return {subject:'user-a',claims:{}};}},allowedOrigins:[]});
  assert.equal((await app.inject({method:'GET',url:'/v1/me'})).statusCode,401);
  assert.equal((await app.inject({method:'GET',url:'/v1/me',headers:{authorization:'Bearer bad'}})).statusCode,401);
  assert.equal((await app.inject({method:'GET',url:'/v1/me',headers:{authorization:'Bearer good'}})).statusCode,200);
  await app.close();
});
test('security: unrelated tenant is not accessible',async()=>{
  const app = await createApp({store,verifier:{async verify(){return {subject:'user-a',claims:{}};}},allowedOrigins:[]});
  const headers={authorization:'Bearer good'};
  assert.equal((await app.inject({method:'GET',url:'/v1/organisations/'+orgA,headers})).statusCode,200);
  assert.equal((await app.inject({method:'GET',url:'/v1/organisations/'+orgB,headers})).statusCode,404);
  await app.close();
});
test('security: staff cannot change memberships',()=>{
  assert.equal(hasPermission('staff','members:manage'),false);
  assert.equal(hasPermission('owner','members:manage'),true);
  assert.equal(hasPermission(null,'organisation:read'),false);
});
