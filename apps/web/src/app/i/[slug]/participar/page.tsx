import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABEL } from "@/lib/format";
import { ActionForm, Submit } from "@/components/form";
import { Field } from "@/components/ui";
import { joinChurch, signupMember } from "../../../(auth)/actions";

export const metadata = { title: "Fazer parte da igreja" };

// Link de convite da igreja (o pastor compartilha): cadastro da equipe e dos membros.
export default async function Participar({ params }: PageProps<"/i/[slug]/participar">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: church } = await supabase.from("churches").select("id, name, logo_url, primary_color")
    .eq("slug", slug).eq("active", true).maybeSingle();
  if (!church) notFound();

  const user = await getUser();
  const { data: m } = user
    ? await supabase.from("memberships").select("role, maint_request, maint_manage").eq("church_id", church.id).eq("user_id", user.id).maybeSingle()
    : { data: null };
  const hasPanel = !!m && (m.role !== "member" || m.maint_request || m.maint_manage);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12" style={{ ["--brand" as string]: church.primary_color }}>
      <div className="mb-6 flex items-center gap-3">
        {church.logo_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={church.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
          : <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand text-xl font-bold text-white">{church.name[0]}</span>}
        <div>
          <p className="text-sm text-zinc-500">Convite</p>
          <h1 className="text-xl font-semibold">{church.name}</h1>
        </div>
      </div>

      {!user && (
        <>
          <p className="text-sm text-zinc-600">Crie sua conta para fazer parte da igreja. Depois, o pastor libera o que você pode acessar (equipe, financeiro, manutenção…).</p>
          <ActionForm action={signupMember} className="mt-6 space-y-4" reset={false}>
            <input type="hidden" name="slug" value={slug} />
            <Field label="Seu nome"><input name="full_name" required className="input" autoComplete="name" /></Field>
            <Field label="E-mail"><input name="email" type="email" required className="input" autoComplete="email" /></Field>
            <Field label="Celular / WhatsApp"><input name="phone" type="tel" className="input" autoComplete="tel" /></Field>
            <Field label="Senha (mín. 8 caracteres)"><input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></Field>
            <Submit className="btn-primary w-full">Criar conta e entrar na igreja</Submit>
          </ActionForm>
          <p className="mt-6 text-sm text-zinc-600">
            Já tem conta? <Link href={`/login?next=/i/${slug}/participar`} className="font-medium underline">Entrar</Link>
          </p>
        </>
      )}

      {user && !m && (
        <form action={joinChurch} className="card space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <p className="text-sm">Você está conectado como <strong>{user.email}</strong>.</p>
          <button className="btn-primary w-full">Entrar na {church.name}</button>
        </form>
      )}

      {user && m && (
        <div className="card space-y-3 text-sm">
          <p>✅ Você faz parte da <strong>{church.name}</strong> como <strong>{STATUS_LABEL[m.role]}</strong>.</p>
          <a href="/app" className="btn-primary block w-full text-center">Abrir o app</a>
          {!hasPanel && (
            <p className="text-zinc-600">
              Se você vai servir na equipe (líder, tesoureiro ou manutenção), avise o pastor que você se cadastrou para ele liberar o seu acesso.
            </p>
          )}
          <Link href={`/i/${slug}`} className="block text-center text-zinc-500 underline">Ver o site da igreja</Link>
        </div>
      )}
    </main>
  );
}
