import Link from "next/link";
import { notFound } from "next/navigation";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Journey } from "@/lib/journey";
import { ActionForm, Submit } from "@/components/form";
import { Field } from "@/components/ui";
import { signupMember } from "../../../(auth)/actions";
import { startJourney } from "./actions";
import { Trail } from "./trail";

export const metadata = { title: "Quero ser membro" };

export default async function QueroSerMembro({ params, searchParams }: PageProps<"/i/[slug]/membro">) {
  const { slug } = await params;
  const { bemvindo } = await searchParams;
  const supabase = await createClient();
  const { data: church } = await supabase.from("churches").select("id, name, logo_url, primary_color, accent_color")
    .eq("slug", slug).eq("active", true).maybeSingle();
  if (!church) notFound();
  const user = await getUser();

  const [{ data: journey }, { data: person }, { data: lessonsRaw }] = user ? await Promise.all([
    supabase.from("member_journeys").select("*").eq("church_id", church.id).eq("user_id", user.id).maybeSingle(),
    supabase.from("people").select("status, phone").eq("church_id", church.id).eq("user_id", user.id).maybeSingle(),
    supabase.from("ncc_lessons").select("id, title").eq("church_id", church.id).order("position"),
  ]) : [{ data: null }, { data: null }, { data: null }];
  const j = journey as Journey | null;
  const { data: att } = j ? await supabase.from("ncc_attendance").select("lesson_id").eq("journey_id", j.id) : { data: [] };
  const attended = new Set((att ?? []).map((a) => a.lesson_id));
  // Visitante sem login não lê os encontros (RLS): mostra a quantidade padrão
  const lessons = lessonsRaw?.length ? lessonsRaw : Array.from({ length: 6 }, (_, i) => ({ id: `x${i}`, title: `Encontro ${i + 1}` }));
  const alreadyMember = person?.status === "membro" && !j;
  const here = `/i/${slug}/membro`;

  return (
    <main className="min-h-screen bg-zinc-50" style={{ ["--brand" as string]: church.primary_color, ["--accent" as string]: church.accent_color ?? church.primary_color }}>
      <header className="bg-brand px-5 pt-6 pb-16 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href={`/i/${slug}`} className="text-sm text-white/80 hover:underline">← {church.name}</Link>
          <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">Quero ser membro 🙌</h1>
          <p className="mt-2 text-white/90">Uma jornada em 4 etapas para você fazer parte da família. Cada passo vale pontos — complete a trilha e ganhe o troféu!</p>
        </div>
      </header>

      <div className="mx-auto -mt-10 max-w-2xl px-4 pb-16">
        {bemvindo && j && (
          <div className="mb-6 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-5 text-center">
            <p className="text-4xl">🎉</p>
            <p className="mt-1 text-lg font-bold text-emerald-900">Primeira etapa concluída! +100 pontos</p>
            <p className="text-sm text-emerald-800">A liderança já foi avisada e vai falar com você para marcar a conversa com o pastor.</p>
          </div>
        )}

        {alreadyMember && (
          <div className="mb-6 rounded-2xl bg-white p-6 text-center shadow">
            <p className="text-4xl">🏆</p>
            <p className="mt-2 font-bold">Você já é membro da {church.name}!</p>
          </div>
        )}

        {!user && (
          <section className="mb-6 rounded-2xl bg-white p-6 shadow-[0_5px_20px_rgba(0,0,0,0.06)]">
            <h2 className="text-lg font-bold">Comece agora</h2>
            <p className="text-sm text-zinc-600">Crie sua conta para acompanhar a sua trilha (pelo site ou pelo app).</p>
            <ActionForm action={signupMember} className="mt-4 space-y-3" reset={false}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="next" value={here} />
              <Field label="Seu nome"><input name="full_name" required className="input" autoComplete="name" /></Field>
              <Field label="E-mail"><input name="email" type="email" required className="input" autoComplete="email" /></Field>
              <Field label="Celular / WhatsApp"><input name="phone" type="tel" className="input" autoComplete="tel" /></Field>
              <Field label="Senha (mín. 8 caracteres)"><input name="password" type="password" minLength={8} required className="input" autoComplete="new-password" /></Field>
              <Submit className="btn-primary w-full">Criar conta</Submit>
            </ActionForm>
            <p className="mt-4 text-sm text-zinc-600">Já tem conta? <Link href={`/login?next=${here}`} className="font-medium underline">Entrar</Link></p>
          </section>
        )}

        {user && !j && !alreadyMember && (
          <section className="mb-6 rounded-2xl bg-white p-6 shadow-[0_5px_20px_rgba(0,0,0,0.06)]">
            <h2 className="text-lg font-bold">Vamos começar? 🚀</h2>
            <ActionForm action={startJourney} className="mt-4 space-y-3" reset={false}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="church_id" value={church.id} />
              <Field label="Celular / WhatsApp (para a liderança falar com você)">
                <input name="phone" type="tel" defaultValue={person?.phone ?? ""} className="input" autoComplete="tel" />
              </Field>
              <Field label="Conte um pouco: por que quer ser membro? (opcional)">
                <textarea name="motivation" rows={3} className="input" />
              </Field>
              <Submit className="btn-primary w-full">🙋 Quero ser membro!</Submit>
            </ActionForm>
          </section>
        )}

        {!alreadyMember && <Trail journey={j} lessons={lessons} attended={attended} />}
      </div>
    </main>
  );
}
