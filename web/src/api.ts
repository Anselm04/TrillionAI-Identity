import { supabase } from "./supabase";
import { sameClientSession } from "./session-continuity";
const apiUrl = import.meta.env.VITE_IDENTITY_API_URL ?? "http://localhost:3000";
function endpoint(path: string): URL {
  const base = new URL(apiUrl);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost","127.0.0.1","[::1]"].includes(base.hostname))) {
    throw new Error("Identity API requires HTTPS");
  }
  if (base.username || base.password || base.search || base.hash || !/^\/(?![\/\\])/.test(path)) throw new Error("Invalid API endpoint");
  const target = new URL(path, base.origin);
  if (target.origin !== base.origin) throw new Error("Cross-origin API path");
  return target;
}
export type ApiResult<T=unknown> = { ok: true; data: T } | { ok: false; status: number; error: string; data?: unknown };
export async function api<T=unknown>(path: string, method="GET", body?: unknown): Promise<ApiResult<T>> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.access_token) return { ok: false, status: 401, error: "Please sign in" };
    const response = await fetch(endpoint(path), {
      redirect: "error",
      cache: "no-store",
      method,
      headers: { Authorization: `Bearer ${session.session.access_token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    // The network response may finish after logout/login or account switching.
    // Supabase owns token refresh; allow rotation within the same session only.
    const { data: latest } = await supabase.auth.getSession();
    if (!sameClientSession(session.session, latest.session)) {
      return { ok: false, status: 401, error: "Session changed. Please retry." };
    }
    if (!response.ok) return { ok: false, status: response.status, error: data.error ?? "Request failed", data };
    return { ok: true, data: data as T };
  } catch { return { ok: false, status: 0, error: "Cannot reach the Identity server" }; }
}
export async function publicPost(path:string, body:unknown):Promise<ApiResult> {
  if(path !== '/auth/passwordless/email') return {ok:false,status:400,error:'Unsupported public API path'};
  try {
    const res=await fetch(endpoint(path),{redirect:"error",cache:"no-store",method:"POST",credentials:"omit",signal:AbortSignal.timeout(20000),headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const data=await res.json().catch(()=>({}));
    return res.ok?{ok:true,data}:{ok:false,status:res.status,error:data.error??"Request failed"};
  } catch {return {ok:false,status:0,error:"Cannot reach the Identity server"};}
}
