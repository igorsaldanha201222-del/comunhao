"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/components/form";

export async function startJourney(_: ActionResult, f: FormData): Promise<ActionResult> {
  const slug = String(f.get("slug"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("journey_start", {
    p_church: String(f.get("church_id")), p_phone: String(f.get("phone") ?? ""), p_motivation: String(f.get("motivation") ?? ""),
  });
  if (error) return { error: error.message };
  redirect(`/i/${slug}/membro?bemvindo=1`);
}
