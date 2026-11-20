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
}).superRefine((settings, ctx) => {
  if (settings.SUPABASE_PUBLISHABLE_KEY === settings.SUPABASE_SERVICE_ROLE_KEY) {
    ctx.addIssue({ code: z.ZodIssueCode.custom,
      message: "Never use a public API key as the privileged service-role key",
      path: ["SUPABASE_SERVICE_ROLE_KEY"] });
  }
  if (process.env.NODE_ENV === "production") {
    const urls = [settings.APP_URL,
      ...(settings.ALLOWED_ORIGINS ?? "").split(",").map(s => s.trim()).filter(Boolean)];
    for (const origin of urls) {
      try {
        if (new URL(origin).protocol !== "https:") throw Error("not HTTPS");
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom,
          message: "Production web origins must be valid HTTPS URLs",
          path: ["ALLOWED_ORIGINS"] });
      }
    }
  }
}).parse(process.env);
