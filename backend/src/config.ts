import "dotenv/config";
import { z } from "zod";
export const config = z.object({
  SUPABASE_URL: z.string().url().refine(s => s.startsWith("https://")),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(8),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(8),
  APP_URL: z.string().url(),
  ALLOWED_ORIGINS: z.string().optional(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
}).parse(process.env);
