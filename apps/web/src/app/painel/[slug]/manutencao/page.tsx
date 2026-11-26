import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { nowMs } from "@/lib/format";
import type { MaintPerson, MaintStatus } from "@/lib/maintenance";
import { PageHeader } from "@/components/ui";
import { Board, type Card } from "./board";
import { RequestForm } from "./request-form";

export const metadata = { title: "Manutenção" };

const DAY = 86_400_000;

export default async function ManutencaoPage({ params, searchParams }: PageProps<"/painel/[slug]/manutencao">) {
  const { slug } = await params;
  const { novo } = await searchParams;
  const { church, supabase, user, canMaintRequest, canMaintManage } = await requireStaff(slug);
  if (!canMaintRequest) redirect(`/painel/${slug}`);

  const since = new Date(nowMs() - 30 * DAY).toISOString();
  const [{ data: rows }, { data: people }] = await Promise.all([
    supabase.from("maintenance_requests")
      .select("id, number, title, location, priority, status, position, photos, requested_by, assigned_to, due_date, created_at, completed_at")
      .eq("church_id", church.id).neq("status", "cancelada")
      .or(`status.neq.concluida,completed_at.gte.${since}`)
      .order("position"),
    supabase.rpc("maintenance_people", { p_church: church.id }),
  ]);
  const names = new Map(((people ?? []) as MaintPerson[]).map((p) => [p.user_id, p.full_name]));
  const list = rows ?? [];

  const thumbs = list.map((r) => r.photos?.[0]).filter(Boolean) as string[];
  const { data: signed } = thumbs.length
    ? await supabase.storage.from("maintenance").createSignedUrls(thumbs, 3600)
    : { data: [] };
  const urlOf = new Map((signed ?? []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl as string]));

  const now = nowMs();
  const today = new Date(now).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const cards: Card[] = list.map((r) => {
    const days = Math.floor((now - new Date(r.created_at).getTime()) / DAY);
    return {
      id: r.id, number: r.number, title: r.title, location: r.location, priority: r.priority,
      status: r.status as MaintStatus, position: r.position,
      thumb: r.photos?.[0] ? urlOf.get(r.photos[0]) ?? null : null, photoCount: r.photos?.length ?? 0,
      assignee: r.assigned_to ? names.get(r.assigned_to) ?? "—" : null,
      requester: r.requested_by ? names.get(r.requested_by) ?? null : null,
      mine: r.assigned_to === user.id, openedByMe: r.requested_by === user.id,
      canMove: canMaintManage || r.assigned_to === user.id,
      age: days === 0 ? "hoje" : days === 1 ? "ontem" : `há ${days} dias`,
      due: r.due_date ? r.due_date.slice(8, 10) + "/" + r.due_date.slice(5, 7) : null,
      overdue: !!r.due_date && r.due_date < today && r.status !== "concluida",
    };
  });
  const open = cards.filter((c) => c.status !== "concluida").length;

  return (
    <>
      <PageHeader
        title="Manutenção"
        subtitle={canMaintManage
          ? `${open} chamado(s) em aberto · arraste os cartões entre as colunas`
          : "Abra um chamado com foto e acompanhe o andamento"}
      />
      <details open={novo !== undefined || (!canMaintManage && cards.length === 0)} className="card mb-6">
        <summary className="cursor-pointer font-semibold">📸 Abrir chamado de manutenção</summary>
        <div className="mt-4"><RequestForm slug={slug} /></div>
      </details>
      <Board slug={slug} cards={cards} canManage={canMaintManage} />
    </>
  );
}
