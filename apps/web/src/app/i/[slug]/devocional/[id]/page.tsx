import Link from "next/link";
import { nowMs } from "@/lib/format";
import { todayBR } from "@/lib/kids";
import { notFound } from "next/navigation";
import { SiteShell, loadSiteChurch } from "../../site-shell";
import { DevotionalView, type Devotional } from "../view";

export const metadata = { title: "Devocional" };

export default async function DevocionalItem({ params }: PageProps<"/i/[slug]/devocional/[id]">) {
  const { slug, id } = await params;
  const { supabase, church } = await loadSiteChurch(slug);
  const { data } = await supabase.from("devotionals").select("*").eq("id", id).eq("church_id", church.id)
    .eq("published", true).lte("publish_on", todayBR(nowMs())).maybeSingle();
  if (!data) notFound();
  return (
    <SiteShell slug={slug} active="/devocional">
      <Link href={`/i/${slug}/devocional`} className="mb-4 inline-block text-sm text-zinc-500 hover:underline">← Devocionais</Link>
      <DevotionalView slug={slug} d={data as Devotional} />
    </SiteShell>
  );
}
