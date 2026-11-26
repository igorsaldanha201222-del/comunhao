import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/** Cliente com privilégio total (ignora RLS). Usar só depois de validar a requisição. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/** Usuário autenticado da requisição, ou null se anônimo/token inválido. */
export async function requestUser(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function isStaff(db: SupabaseClient, churchId: string, userId: string) {
  const { data } = await db
    .from("memberships")
    .select("role")
    .eq("church_id", churchId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data && ["owner", "admin", "leader"].includes(data.role);
}
