import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DonateForm } from "./donate-form";

export const metadata = { title: "Contribuir" };

export default async function DoarPage({ params }: PageProps<"/i/[slug]/doar">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: church } = await supabase.from("churches").select("id, name, primary_color").eq("slug", slug).eq("active", true).maybeSingle();
  if (!church) notFound();
  const { data: funds } = await supabase.from("donation_funds").select("id, name").eq("church_id", church.id).eq("active", true).order("position");

  return (
    <main className="mx-auto max-w-md px-6 py-12" style={{ ["--brand" as string]: church.primary_color }}>
      <h1 className="text-2xl font-semibold">Contribuir com {church.name}</h1>
      <p className="mt-1 text-sm text-zinc-500">Dízimos e ofertas por Pix, cartão ou boleto, em ambiente seguro.</p>
      <DonateForm churchId={church.id} funds={funds ?? []} />
    </main>
  );
}
