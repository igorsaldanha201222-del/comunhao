import { requireStaff } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { ActionForm, Submit } from "@/components/form";
import { Empty, Field, PageHeader } from "@/components/ui";
import { createNotification } from "../actions";

export const metadata = { title: "Notificações" };

export default async function NotificacoesPage({ params }: PageProps<"/painel/[slug]/notificacoes">) {
  const { slug } = await params;
  const { church, supabase } = await requireStaff(slug);
  const [{ data: list }, { count: devices }] = await Promise.all([
    supabase.from("notifications").select("*").eq("church_id", church.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("push_tokens").select("*", { count: "exact", head: true }).eq("church_id", church.id),
  ]);

  return (
    <>
      <PageHeader title="Notificações" subtitle={`Push no celular dos membros · ${devices ?? 0} aparelho(s) cadastrados`} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="space-y-3">
          {list?.length ? list.map((n) => (
            <article key={n.id} className="card">
              <div className="flex justify-between gap-2">
                <h2 className="font-medium">{n.title}</h2>
                <span className="text-xs text-zinc-500">{n.sent_at ? `${dateTime(n.sent_at)} · ${n.sent_count} entregues` : "não enviada"}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-600">{n.body}</p>
            </article>
          )) : <Empty>Nenhuma notificação enviada.</Empty>}
        </section>
        <section className="card h-fit">
          <h2 className="mb-4 font-semibold">Enviar notificação</h2>
          <ActionForm action={createNotification} className="space-y-3">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Título"><input name="title" required maxLength={60} className="input" /></Field>
            <Field label="Mensagem"><textarea name="body" required maxLength={240} rows={4} className="input" /></Field>
            <Field label="Link (opcional)"><input name="link_url" type="url" className="input" /></Field>
            <Submit>Enviar agora</Submit>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
