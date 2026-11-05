import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export interface Principal { subject: string; claims: JWTPayload }
export interface TokenVerifier { verify(token: string): Promise<Principal> }

/**
 * OIDC token verification. Never trust a decoded but unverified JWT.
 * The resource-server audience is distinct from a frontend application's client ID.
 */
export function createTokenVerifier(issuer: string, audience: string): TokenVerifier {
  const normalized = issuer.replace(/\/$/, '');
  const jwks = createRemoteJWKSet(new URL(normalized + '/protocol/openid-connect/certs'));
  return {
    async verify(token: string): Promise<Principal> {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: normalized,
        audience,
        algorithms: ['RS256', 'PS256', 'ES256'],
        clockTolerance: 5,
        requiredClaims: ['sub', 'exp', 'iat', 'iss', 'aud']
      });
      if (!payload.sub || !payload.exp || !payload.iat) throw new Error('Missing token claims');
      return { subject: payload.sub, claims: payload };
    }
  };
}
