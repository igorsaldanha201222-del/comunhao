import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { STATUS_LABEL, date } from "@/lib/format";
import { Badge, Empty, PageHeader } from "@/components/ui";
import { PersonForm } from "./person-form";

export const metadata = { title: "Pessoas" };

export default async function PessoasPage({ params, searchParams }: PageProps<"/painel/[slug]/pessoas">) {
  const { slug } = await params;
  const { q, status } = await searchParams;
  const { church, supabase } = await requireStaff(slug);

  let query = supabase.from("people").select("id, full_name, phone, email, status, birth_date, user_id")
    .eq("church_id", church.id).order("full_name").limit(500);
  if (typeof q === "string" && q) query = query.ilike("full_name", `%${q.replace(/[%_]/g, "")}%`);
  if (typeof status === "string" && status) query = query.eq("status", status);
  const { data: people } = await query;

  return (
    <>
      <PageHeader title="Pessoas" subtitle="Membros, visitantes e novos convertidos" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <form className="mb-4 flex gap-2">
            <input name="q" defaultValue={typeof q === "string" ? q : ""} placeholder="Buscar por nome" className="input" />
            <select name="status" defaultValue={typeof status === "string" ? status : ""} className="input w-44">
              <option value="">Todas</option>
              <option value="visitante">Visitantes</option>
              <option value="novo_convertido">Novos convertidos</option>
              <option value="membro">Membros</option>
              <option value="inativo">Inativos</option>
            </select>
            <button className="btn-ghost">Filtrar</button>
          </form>
          {people?.length ? (
            <div className="card overflow-x-auto p-0">
              <table className="tbl">
                <thead><tr><th>Nome</th><th>Situação</th><th>Telefone</th><th>Nascimento</th></tr></thead>
                <tbody>
                  {people.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/painel/${slug}/pessoas/${p.id}`} className="font-medium hover:underline">{p.full_name}</Link>
                        {p.user_id && <span className="ml-2 text-xs text-zinc-400">usa o app</span>}
                      </td>
                      <td><Badge tone={p.status === "membro" ? "green" : p.status === "inativo" ? "zinc" : "amber"}>{STATUS_LABEL[p.status]}</Badge></td>
                      <td>{p.phone ?? "—"}</td>
                      <td>{date(p.birth_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>Nenhuma pessoa encontrada.</Empty>
          )}
        </section>
        <section className="card h-fit">
          <h2 className="mb-4 font-semibold">Nova pessoa</h2>
          <PersonForm slug={slug} />
        </section>
      </div>
    </>
  );
}
