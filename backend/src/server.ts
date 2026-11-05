import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { createTokenVerifier } from './auth.js';
import { PostgresIdentityStore } from './db.js';

const config = loadConfig();
const store = new PostgresIdentityStore(config.DATABASE_URL);
const app = await createApp({
  store,
  verifier: createTokenVerifier(config.OIDC_ISSUER, config.OIDC_AUDIENCE),
  allowedOrigins: config.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
});
app.addHook('onClose', async () => { await store.close(); });
try {
  await app.listen({ port: config.PORT, host: '0.0.0.0' });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
  await app.close();
}
