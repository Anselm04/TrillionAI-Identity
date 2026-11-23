import { z } from "zod";

// Client metadata follows Keycloak ClientRepresentation (Apache-2.0),
// adapted to strict OAuth redirect URI registration, not Java runtime code.
// Keep callback query rules aligned with sdk/typescript/oauth.ts.
const reservedOAuthParameters = new Set(["state", "code", "error", "error_description", "error_uri"]);
export const redirectUri = z.string().max(2048).refine(value => {
  if (/[\s*\\]/.test(value)) return false;
  try {
    const uri = new URL(value);
    if (uri.protocol !== "https:" || uri.username || uri.password ||
        uri.hash || value.includes("#") || uri.href !== value) return false;
    // OAuth response parameters are supplied by the issuer. They must not
    // already be registered in a callback, or the SDK will reject the flow.
    for (const name of new Set(uri.searchParams.keys())) {
      if (reservedOAuthParameters.has(name) ||
          uri.searchParams.getAll(name).length !== 1) return false;
    }
    return true;
  } catch { return false; }
}, "Use a canonical HTTPS callback without reserved or duplicate OAuth parameters");

export const developerClientInput = z.object({
  name: z.string().trim().min(1).max(100),
  redirect_uris: z.array(redirectUri).min(1).max(10)
    .refine(v => new Set(v).size === v.length, "Duplicate redirect URI"),
  client_type: z.enum(["public", "confidential"]),
}).strict();
