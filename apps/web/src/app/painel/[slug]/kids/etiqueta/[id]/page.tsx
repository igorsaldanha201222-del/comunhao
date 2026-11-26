import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { date, nowMs } from "@/lib/format";
import { ageLabel } from "@/lib/kids";
import { PrintButton } from "./print-button";

export const metadata = { title: "Etiqueta Kids" };

// Duas etiquetas com o mesmo código: uma vai na criança, a outra fica com o responsável.
export default async function Etiqueta({ params }: PageProps<"/painel/[slug]/kids/etiqueta/[id]">) {
  const { slug, id } = await params;
  const { church, supabase, canKids } = await requireStaff(slug);
  if (!canKids) redirect(`/painel/${slug}`);
  const { data: r } = await supabase.from("kids_checkins")
    .select("security_code, service_date, kids_children(full_name, birth_date, allergies), kids_rooms(name, color)")
    .eq("id", id).eq("church_id", church.id).maybeSingle();
  if (!r) notFound();
  const k = r.kids_children as unknown as { full_name: string; birth_date: string | null; allergies: string | null };
  const room = r.kids_rooms as unknown as { name: string; color: string } | null;
  const label = "w-[90mm] rounded-lg border-2 border-dashed border-zinc-400 p-4 break-inside-avoid";

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 print:p-0">
      <div className="print:hidden"><PrintButton /></div>
      <div className={label} style={{ borderLeft: `10px solid ${room?.color ?? "#000"}` }}>
        <p className="text-xs uppercase text-zinc-500">{church.name} · {date(r.service_date)}</p>
        <p className="mt-1 text-2xl font-bold leading-tight">{k.full_name}</p>
        <p className="text-sm">{room?.name ?? "—"} · {ageLabel(k.birth_date, nowMs()) ?? ""}</p>
        {k.allergies && <p className="mt-1 rounded bg-black px-2 py-1 text-sm font-bold text-white">⚠ ALERGIA: {k.allergies}</p>}
        <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em]">{r.security_code}</p>
      </div>
      <div className={label}>
        <p className="text-xs uppercase text-zinc-500">Responsável · guarde para a retirada</p>
        <p className="mt-1 font-semibold">{k.full_name} · {room?.name}</p>
        <p className="mt-1 font-mono text-4xl font-bold tracking-[0.3em]">{r.security_code}</p>
        <p className="mt-1 text-xs text-zinc-500">A criança só é entregue com este código.</p>
      </div>
    </div>
  );
}
