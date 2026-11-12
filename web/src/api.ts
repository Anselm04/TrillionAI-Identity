import { supabase } from "./supabase";
const apiUrl = import.meta.env.VITE_IDENTITY_API_URL ?? "http://localhost:3000";
export type ApiResult<T=unknown> = { ok: true; data: T } | { ok: false; status: number; error: string; data?: unknown };
export async function api<T=unknown>(path: string, method="GET", body?: unknown): Promise<ApiResult<T>> {
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.access_token) return { ok: false, status: 401, error: "Please sign in" };
    const response = await fetch(apiUrl + path, {
      method,
      headers: { Authorization: `Bearer ${session.session.access_token}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, status: response.status, error: data.error ?? "Request failed", data };
    return { ok: true, data: data as T };
  } catch { return { ok: false, status: 0, error: "Cannot reach the Identity server" }; }
}
export async function publicPost(path:string, body:unknown):Promise<ApiResult> {
  try {
    const res=await fetch(apiUrl + path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const data=await res.json().catch(()=>({}));
    return res.ok?{ok:true,data}:{ok:false,status:res.status,error:data.error??"Request failed"};
  } catch {return {ok:false,status:0,error:"Cannot reach the Identity server"};}
}
