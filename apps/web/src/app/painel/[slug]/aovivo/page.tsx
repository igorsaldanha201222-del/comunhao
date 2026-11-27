import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { liveEmbed } from "@/lib/live";
import { ActionForm, Submit } from "@/components/form";
import type { ActionResult } from "@/components/form";
import { Field, PageHeader } from "@/components/ui";

export const metadata = { title: "Ao vivo" };

async function setLive(_: ActionResult, f: FormData): Promise<ActionResult> {
  "use server";
  const slug = String(f.get("slug"));
  const c = await requireStaff(slug);
  const on = f.get("on") === "1";
  const url = String(f.get("live_url") ?? "").trim();
  if (on && url && !liveEmbed(url) && !/youtube\.com|youtu\.be/.test(url)) return { error: "Use um link do YouTube (da live ou do canal)." };
  const { error } = await c.supabase.rpc("set_live", { p_church: c.church.id, p_on: on, p_url: url, p_title: String(f.get("live_title") ?? "") });
  if (error) return { error: error.message };
  revalidatePath(`/i/${slug}`, "layout");
  revalidatePath(`/painel/${slug}/aovivo`);
  return { ok: on ? "🔴 O site está mostrando a transmissão ao vivo." : "Transmissão encerrada no site." };
}

export default async function AoVivoPainel({ params }: PageProps<"/painel/[slug]/aovivo">) {
  const { slug } = await params;
  const { church, isStaff } = await requireStaff(slug);
  if (!isStaff) redirect(`/painel/${slug}`);
  const ok = !!liveEmbed(church.live_url);

  return (
    <>
      <PageHeader title="Transmissão ao vivo" subtitle="Quando ligado, o site da igreja mostra a live com destaque em vermelho"
        actions={<a href={`/i/${slug}/aovivo`} target="_blank" className="btn-ghost">Ver no site ↗</a>} />
      <section className={`card max-w-xl ${church.live_on ? "border-red-300 bg-red-50/50" : ""}`}>
        <p className="mb-4 text-lg font-bold">{church.live_on ? "🔴 Estamos AO VIVO no site" : "⚪ Transmissão desligada"}</p>
        <ActionForm action={setLive} reset={false} className="space-y-3">
          <input type="hidden" name="slug" value={slug} />
          <Field label="Link da live no YouTube">
            <input name="live_url" defaultValue={church.live_url ?? ""} placeholder="https://youtube.com/live/… ou https://youtube.com/channel/UC…" className="input" />
          </Field>
          {church.live_url && !ok && <p className="text-xs text-amber-700">Esse link abre o YouTube, mas não dá para mostrar o vídeo dentro do site. Use o link da live (youtube.com/live/…) ou do canal no formato /channel/UC….</p>}
          <Field label="Título (opcional)"><input name="live_title" defaultValue={church.live_title ?? ""} placeholder="ex.: Culto da Família" className="input" /></Field>
          <div className="flex gap-2">
            <input type="hidden" name="on" value={church.live_on ? "0" : "1"} />
            <Submit className={church.live_on ? "btn-ghost w-full" : "btn-primary w-full !bg-red-600"}>
              {church.live_on ? "⏹ Encerrar transmissão" : "🔴 Estamos ao vivo!"}
            </Submit>
          </div>
        </ActionForm>
        <p className="mt-4 text-xs text-zinc-500">
          Dica: com o link do canal (youtube.com/channel/UC…), o site mostra sozinho a live que estiver passando — não precisa trocar o link a cada culto.
        </p>
      </section>
    </>
  );
}
