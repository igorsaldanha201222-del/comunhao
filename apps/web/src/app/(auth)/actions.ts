"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/components/form";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function login(_: ActionResult, f: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: str(f, "email"), password: str(f, "password") });
  if (error) return { error: "E-mail ou senha inválidos." };
  const next = str(f, "next");
  redirect(next.startsWith("/painel") ? next : "/painel");
}

export async function signupChurch(_: ActionResult, f: FormData): Promise<ActionResult> {
  const name = str(f, "full_name");
  const email = str(f, "email");
  const password = str(f, "password");
  const churchName = str(f, "church_name");
  const slug = str(f, "slug").toLowerCase();

  if (!name || !email || password.length < 8) return { error: "Preencha nome, e-mail e senha (mín. 8 caracteres)." };
  if (!churchName || !/^[a-z0-9-]{3,40}$/.test(slug))
    return { error: "Código da igreja: 3 a 40 letras minúsculas, números ou hífen." };

  const supabase = await createClient();
  const { data: exists } = await supabase.from("churches").select("id").eq("slug", slug).maybeSingle();
  if (exists) return { error: "Esse código já está em uso. Escolha outro." };

  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name }, emailRedirectTo: `${origin}/auth/callback?next=/painel` },
  });
  if (error) return { error: error.message };

  // Sem confirmação de e-mail ativa a sessão já existe; com confirmação, cria a igreja no primeiro acesso.
  if (!data.session) {
    return { ok: "Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, entre e cadastre a igreja." };
  }
  const { error: cErr } = await supabase.rpc("create_church", { p_name: churchName, p_slug: slug });
  if (cErr) return { error: "Conta criada, mas não foi possível criar a igreja: " + cErr.message };
  redirect(`/painel/${slug}`);
}

export async function createChurch(_: ActionResult, f: FormData): Promise<ActionResult> {
  const slug = str(f, "slug").toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return { error: "Código inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_church", { p_name: str(f, "church_name"), p_slug: slug });
  if (error) return { error: error.message.includes("duplicate") ? "Esse código já está em uso." : error.message };
  redirect(`/painel/${slug}`);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
