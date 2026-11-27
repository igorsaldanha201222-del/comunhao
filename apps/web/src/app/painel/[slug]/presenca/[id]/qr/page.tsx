import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import QRCode from "qrcode";
import { requireStaff } from "@/lib/auth";
import { date } from "@/lib/format";
import { PrintButton } from "@/app/painel/[slug]/kids/etiqueta/[id]/print-button";

export const metadata = { title: "QR Code do culto" };

/** QR Code para imprimir ou projetar na entrada: o membro aponta a câmera e a presença é marcada. */
export default async function QrCulto({ params }: PageProps<"/painel/[slug]/presenca/[id]/qr">) {
  const { slug, id } = await params;
  const { church, supabase, canAttendance } = await requireStaff(slug);
  if (!canAttendance) redirect(`/painel/${slug}`);
  const { data: svc } = await supabase.from("services").select("id, title, service_date").eq("id", id).eq("church_id", church.id).maybeSingle();
  if (!svc) notFound();
  const { data: token, error } = await supabase.rpc("service_qr_token", { p_service: id });
  if (error || !token) notFound();
  const h = await headers();
  const url = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}/app/presenca?qr=${token}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 360, color: { dark: "#18181b" } });

  return (
    <div className="mx-auto max-w-md text-center">
      <Link href={`/painel/${slug}/presenca/${id}`} className="text-sm text-zinc-500 hover:underline print:hidden">← Voltar à chamada</Link>
      <div className="card mt-4 space-y-4 py-8">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">{church.name}</p>
        <h1 className="text-3xl font-extrabold">Bem-vindo! 🙏</h1>
        <p className="text-zinc-600">Aponte a câmera do celular para marcar sua presença no <strong>{svc.title}</strong></p>
        <div className="mx-auto w-72" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-xs text-zinc-500">{date(svc.service_date)} · vale só hoje</p>
      </div>
      <div className="mt-4 print:hidden"><PrintButton /></div>
    </div>
  );
}
