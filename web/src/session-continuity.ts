/** UI-only session continuity check; never use unverified JWT claims to authorize. */
export type ClientSessionSnapshot = { access_token: string; user: { id: string } };
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function clientSessionId(token: string): string | null {
  try {
    const parts=token.split(".");
    if(parts.length!==3||!parts.every(Boolean))return null;
    const payload=JSON.parse(atob(parts[1].replace(/-/g,"+").replace(/_/g,"/"))) as unknown;
    if(!payload||typeof payload!=="object")return null;
    const id=(payload as Record<string,unknown>).session_id;
    return typeof id==="string"&&uuid.test(id)?id.toLowerCase():null;
  } catch { return null; }
}
/** Same signed-provider session can rotate access tokens; account switches cannot. */
export function sameClientSession(
  before: ClientSessionSnapshot|null|undefined,
  after: ClientSessionSnapshot|null|undefined
): boolean {
  if(!before||!after||!uuid.test(before.user.id)||before.user.id!==after.user.id)return false;
  const a=clientSessionId(before.access_token);
  const b=clientSessionId(after.access_token);
  // Tokens lacking session IDs are not considered continuous.
  return a!==null&&a===b;
}
