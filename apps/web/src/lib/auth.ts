import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "./supabase/server";

export type Role = "owner" | "admin" | "leader" | "treasurer" | "member";

export type Church = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  about: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  instagram: string | null;
  youtube_channel: string | null;
  plan: string;
  accent_color: string | null;
  hero_url: string | null;
  tagline: string | null;
  service_times: string | null;
  email: string | null;
  pix_key: string | null;
};

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Igreja do painel + papel do usuário. Entram no painel: equipe (owner/admin/leader), tesoureiro
 * e membros que o pastor liberou para a manutenção (abrir chamados ou cuidar do quadro).
 */
export const requireStaff = cache(async (slug: string) => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: church } = await supabase.from("churches").select("*").eq("slug", slug).maybeSingle<Church>();
  if (!church) notFound();
  const { data: m } = await supabase
    .from("memberships").select("role, maint_request, maint_manage").eq("church_id", church.id).eq("user_id", user.id).maybeSingle();
  const role = m?.role as Role | undefined;
  const isAdmin = role === "owner" || role === "admin";
  const canMaintManage = isAdmin || !!m?.maint_manage;
  const canMaintRequest = canMaintManage || !!m?.maint_request;
  const { data: canKids } = role ? await supabase.rpc("kids_can_manage", { p_church: church.id }) : { data: false };
  if (!role || (role === "member" && !canMaintRequest && !canKids)) redirect("/painel?erro=sem-acesso");
  return {
    user, church, role, supabase, isAdmin,
    canFinance: isAdmin || role === "treasurer",
    isStaff: role === "owner" || role === "admin" || role === "leader",
    canMaintManage, canMaintRequest, canKids: !!canKids,
  };
});
