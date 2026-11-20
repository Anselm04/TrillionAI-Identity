/** Shared client-side ergonomics. The server/Auth provider remains authoritative. */
export function validateRegistration(email: string, password: string, confirmation: string): string | null {
  const address=email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length>254) return "Enter a valid email";
  if (password.length<12 || password.length>128) return "Password must be 12–128 characters";
  if (password!==confirmation) return "Passwords do not match";
  return null;
}
