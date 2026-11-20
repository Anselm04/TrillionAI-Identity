import { z } from "zod";

// Client metadata follows Keycloak ClientRepresentation (Apache-2.0),
// adapted to strict OAuth redirect URI registration, not Java runtime code.
export const redirectUri = z.string().max(2048).refine(value => {
  if (/[\s*\\]/.test(value)) return false;
  try {
    const uri = new URL(value);
    return uri.protocol === "https:" && !uri.username && !uri.password &&
      !uri.hash && !value.includes("#") && uri.href === value;
  } catch { return false; }
}, "Use a canonical HTTPS callback URL without wildcards or fragments");

export const developerClientInput = z.object({
  name: z.string().trim().min(1).max(100),
  redirect_uris: z.array(redirectUri).min(1).max(10)
    .refine(v => new Set(v).size === v.length, "Duplicate redirect URI"),
  client_type: z.enum(["public", "confidential"]),
}).strict();
