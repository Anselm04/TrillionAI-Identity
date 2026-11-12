import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;
export const admin = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, options);
export function publicAuthClient() { return createClient(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY, options); }
