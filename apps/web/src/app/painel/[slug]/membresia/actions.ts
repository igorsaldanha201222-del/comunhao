"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { fromLocalInput } from "@/lib/format";

const s = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

async function ctx(f: FormData) {
  const slug = String(f.get("slug"));
  const c = await requireStaff(slug);
  if (!c.isStaff) throw new Error("Só a liderança.");
  return { ...c, slug };
}
const done = (slug: string) => revalidatePath(`/painel/${slug}/membresia`);

async function patch(f: FormData, row: Record<string, unknown>) {
  const c = await ctx(f);
  const { error } = await c.supabase.from("member_journeys").update(row).eq("id", String(f.get("id"))).eq("church_id", c.church.id);
  if (error) throw new Error(error.message);
  done(c.slug);
}

export async function scheduleTalk(f: FormData) {
  await patch(f, { talk_at: fromLocalInput(f.get("talk_at")), talk_with: s(f, "talk_with") });
}
export async function talkDone(f: FormData) {
  await patch(f, { talk_done_at: f.get("undo") ? null : new Date().toISOString() });
}
export async function setNccClass(f: FormData) {
  await patch(f, { ncc_class: s(f, "ncc_class") });
}
export async function setPresentation(f: FormData) {
  await patch(f, { presentation_date: s(f, "presentation_date") });
}
export async function presented(f: FormData) {
  await patch(f, { presented_at: f.get("undo") ? null : new Date().toISOString() });
}
export async function giveUp(f: FormData) {
  await patch(f, { gave_up: f.get("value") === "1" });
}

export async function toggleAttendance(f: FormData) {
  const c = await ctx(f);
  const journey_id = String(f.get("id"));
  const lesson_id = String(f.get("lesson_id"));
  if (f.get("on") === "1") {
    await c.supabase.from("ncc_attendance").upsert({ journey_id, lesson_id, church_id: c.church.id });
  } else {
    await c.supabase.from("ncc_attendance").delete().eq("journey_id", journey_id).eq("lesson_id", lesson_id);
  }
  done(c.slug);
}

export async function addLesson(f: FormData) {
  const c = await ctx(f);
  const title = s(f, "title");
  if (!title) return;
  await c.supabase.from("ncc_lessons").insert({ church_id: c.church.id, title, description: s(f, "description"), position: Number(f.get("position") ?? 99) });
  done(c.slug);
}
export async function removeLesson(f: FormData) {
  const c = await ctx(f);
  await c.supabase.from("ncc_lessons").delete().eq("id", String(f.get("lesson_id"))).eq("church_id", c.church.id);
  done(c.slug);
}
