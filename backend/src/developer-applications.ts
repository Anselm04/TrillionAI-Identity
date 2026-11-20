import { z } from "zod";

export const redirectUri = z.string().max(2048).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) &&
      !url.username && !url.password && !url.hash &&
      value === value.trim() && !/[\x00-\x20\x7f\\]/.test(value) &&
      !value.includes("*") && !value.includes("#");
  } catch { return false; }
}, "An exact HTTPS redirect URI without credentials, fragments or wildcards is required");

export const applicationInput = z.object({
  name: z.string().trim().min(1).max(100),
  redirect_uris: z.array(redirectUri).min(1).max(10)
    .refine(values => new Set(values).size === values.length, "Duplicate redirect URI"),
}).strict();

export const applicationId = z.string().uuid();
export const applicationPage = z.object({after: applicationId.optional()}).strict();
