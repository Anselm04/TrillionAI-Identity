import "../src/config.js";
import { admin } from "../src/supabase.js";
const id = process.argv[2]?.trim();
const expectedEmail = process.argv[3]?.trim().toLowerCase();
if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !expectedEmail || !expectedEmail.includes("@")) {
  console.error("Usage: npm run assign-owner -- <verified-user-uuid> <expected-owner-email>");
  process.exit(1);
}
const {data, error} = await admin.auth.admin.getUserById(id);
if (error || !data.user || data.user.email?.toLowerCase()!==expectedEmail ||
  !data.user.email_confirmed_at ||
  !data.user.factors?.some(f=>f.factor_type==="totp" && f.status==="verified")) {
  console.error("Identity does not match confirmed email plus verified TOTP enrollment.");
  process.exit(1);
}
const existing = await admin.from("user_roles").select("user_id").eq("role","owner").maybeSingle();
if (existing.error || (existing.data && existing.data.user_id !== id)) {
  console.error("Owner role already assigned or role store unavailable.");
  process.exit(1);
}
if (existing.data?.user_id === id) {
  console.info("This verified user already has the owner role.");
  process.exit(0);
}
const { error: assignError } = await admin.from("user_roles").insert({user_id:id,role:"owner"});
if (assignError) {
  console.error("Owner assignment failed:",assignError.message);
  process.exit(1);
}
console.info("Owner role assigned to the confirmed, TOTP-enrolled user ID.");
