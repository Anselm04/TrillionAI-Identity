import Fastify, { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { hasPermission } from './authorisation.js';
import type { IdentityStore } from './db.js';
import type { TokenVerifier } from './auth.js';

export interface AppDependencies {
  store: IdentityStore;
  verifier: TokenVerifier;
  allowedOrigins: string[];
}
const orgParams = z.object({ organisationId: z.string().uuid() });
export async function createApp(deps: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({ logger: { redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'] }, trustProxy: false, bodyLimit: 32768 });
  await app.register(helmet);
  await app.register(cors, { origin: deps.allowedOrigins.length ? deps.allowedOrigins : false, credentials: false });
  await app.register(rateLimit, { max: 60, timeWindow: '1 minute' });
  app.get('/health/live', async () => ({ status: 'live' }));

  app.addHook('onRequest', async (request, reply) => {
    if (request.url.startsWith('/health/')) return;
    const header = request.headers.authorization;
    if (!header || !/^Bearer [^ ]+$/.test(header)) {
      reply.header('WWW-Authenticate', 'Bearer').code(401).send({ error: 'unauthorized' });
      return;
    }
    try {
      const principal = await deps.verifier.verify(header.slice(7));
      request.identitySubject = principal.subject;
    } catch {
      reply.header('WWW-Authenticate', 'Bearer error="invalid_token"').code(401).send({ error: 'unauthorized' });
    }
  });

  app.get('/v1/me', async request => ({ subject: request.identitySubject }));
  app.get('/v1/organisations', async request => {
    return { organisations: await deps.store.listOrganisations(request.identitySubject!) };
  });
  app.get('/v1/organisations/:organisationId', async (request, reply) => {
    const params = orgParams.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: 'invalid_organisation_id' });
    const membership = await deps.store.membership(params.data.organisationId, request.identitySubject!);
    if (!hasPermission(membership?.role ?? null, 'organisation:read')) {
      return reply.code(404).send({ error: 'not_found' });
    }
    const org = await deps.store.organisation(params.data.organisationId);
    if (!org) return reply.code(404).send({ error: 'not_found' });
    return { organisation: org, role: membership!.role };
  });
  return app;
}
declare module 'fastify' {
  interface FastifyRequest { identitySubject?: string }
}
