import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { STATUS_LABEL, brl, dateTime } from "@/lib/format";
import { ConfirmButton } from "@/components/form";
import { Empty, PageHeader } from "@/components/ui";
import { deleteEntry } from "../actions";
import { EntryForm, type Entry } from "../entry-form";

const FIELD_LABEL: Record<string, string> = {
  amount_cents: "valor", description: "descrição", entry_date: "data", status: "situação", category_id: "categoria",
  account_id: "conta", counterparty: "fornecedor", document_number: "nº documento", attachment_path: "anexo", type: "tipo", due_date: "vencimento",
};

export default async function LancamentoPage({ params }: PageProps<"/painel/[slug]/financeiro/[id]">) {
  const { slug, id } = await params;
  const { church, supabase, canFinance } = await requireStaff(slug);
  if (!canFinance) return <Empty>Só administradores e tesoureiros acessam o financeiro.</Empty>;

  const { data: entry } = await supabase.from("finance_entries").select("*").eq("id", id).eq("church_id", church.id).maybeSingle<Entry>();
  if (!entry) notFound();

  const [{ data: categories }, { data: accounts }, { data: audit }, signed] = await Promise.all([
    supabase.from("finance_categories").select("id, name, type").eq("church_id", church.id).order("name"),
    supabase.from("finance_accounts").select("id, name").eq("church_id", church.id).order("name"),
    supabase.from("finance_audit").select("action, by_user, at, before, after").eq("entry_id", id).order("at", { ascending: false }),
    entry.attachment_path
      ? supabase.storage.from("finance").createSignedUrl(entry.attachment_path, 600) // link válido por 10 min
      : Promise.resolve({ data: null }),
  ]);

  // Nomes de quem mexeu (equipe financeira vê nome via memberships → people)
  const ids = [...new Set((audit ?? []).map((a) => a.by_user).filter(Boolean))] as string[];
  const { data: who } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameOf = new Map((who ?? []).map((p) => [p.id, p.full_name]));

  const isPdf = entry.attachment_path?.endsWith(".pdf");
  const fileUrl = signed.data?.signedUrl;

  return (
    <>
      <PageHeader
        title={entry.description}
        subtitle={`${STATUS_LABEL[entry.type]} · ${brl(Number(entry.amount_cents))}`}
        actions={
          <>
            <Link href={`/painel/${slug}/financeiro`} className="btn-ghost">Voltar</Link>
            {entry.source !== "online" && (
              <form action={deleteEntry}>
                <input type="hidden" name="slug" value={slug} /><input type="hidden" name="id" value={id} />
                <ConfirmButton message="Excluir este lançamento? Fica registrado no histórico.">Excluir</ConfirmButton>
              </form>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <EntryForm slug={slug} categories={categories ?? []} accounts={accounts ?? []} entry={entry} />
        </section>
        <div className="space-y-6">
          <section className="card">
            <h2 className="font-semibold">Nota / comprovante</h2>
            {fileUrl ? (
              <>
                {isPdf ? (
                  <iframe src={fileUrl} title="Nota" className="mt-3 h-[480px] w-full rounded-lg border border-zinc-200" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fileUrl} alt="Nota anexada" className="mt-3 max-h-[480px] w-full rounded-lg border border-zinc-200 object-contain" />
                )}
                <a href={fileUrl} target="_blank" className="mt-2 inline-block text-sm underline">Abrir em nova aba</a>
              </>
            ) : <p className="mt-2 text-sm text-zinc-500">Nenhum arquivo anexado. Envie pelo formulário ao lado.</p>}
          </section>
          <section className="card">
            <h2 className="font-semibold">Histórico</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {(audit ?? []).map((a, i) => {
                const changed = a.action === "alterou" && a.before && a.after
                  ? Object.keys(FIELD_LABEL).filter((k) => JSON.stringify(a.before[k]) !== JSON.stringify(a.after[k])).map((k) => FIELD_LABEL[k])
                  : [];
                return (
                  <li key={i} className="flex justify-between gap-2">
                    <span>
                      <strong>{a.by_user ? nameOf.get(a.by_user) ?? "Usuário" : "Sistema"}</strong> {a.action}
                      {changed.length > 0 && <span className="text-zinc-500"> ({changed.join(", ")})</span>}
                    </span>
                    <span className="whitespace-nowrap text-zinc-500">{dateTime(a.at)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
