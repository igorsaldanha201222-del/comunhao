// Exemplo da trilha "Quero ser membro" (rode depois do seed-demo.mjs).
import { createRequire } from "node:module";
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const SB_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const admin = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ok = ({ data, error }) => { if (error) throw error; return data; };

const { id: cid } = ok(await admin.from("churches").select("id").eq("slug", "gileade").single());
if (ok(await admin.from("member_journeys").select("id").eq("church_id", cid)).length) {
  console.log("Trilha já tem dados — nada a fazer.");
  process.exit(0);
}

const PEOPLE = [
  { email: "visitante@demo.com", name: "Carlos Mendes", phone: "(85) 98877-1020", why: "Minha família começou a frequentar e queremos servir.", stage: "ncc" },
  { email: "juliana.visit@demo.com", name: "Juliana Prado", phone: "(85) 98877-1021", why: "Me converti no último retiro!", stage: "conversa" },
  { email: "rafael.visit@demo.com", name: "Rafael Nunes", phone: "(85) 98877-1022", why: null, stage: "conversa_marcada" },
  { email: "beatriz.visit@demo.com", name: "Beatriz Alves", phone: "(85) 98877-1023", why: "Quero me batizar e fazer parte.", stage: "apresentacao" },
  { email: "tiago.visit@demo.com", name: "Tiago e Lara Souza", phone: "(85) 98877-1024", why: null, stage: "concluido" },
];

const lessons = ok(await admin.from("ncc_lessons").select("id").eq("church_id", cid).order("position"));
const day = (n) => new Date(Date.now() + n * 864e5);
const dateOnly = (d) => d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

for (const p of PEOPLE) {
  const { error } = await admin.auth.admin.createUser({
    email: p.email, password: "demo12345", email_confirm: true, user_metadata: { full_name: p.name, phone: p.phone },
  });
  if (error && !String(error.message).includes("registered")) throw error;
  // O visitante abre a trilha como ele mesmo (mesmo caminho do botão do site)
  const c = createClient(SB_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  ok(await c.auth.signInWithPassword({ email: p.email, password: "demo12345" }));
  const j = ok(await c.rpc("journey_start", { p_church: cid, p_phone: p.phone, p_motivation: p.why }));

  const upd = {};
  if (p.stage === "conversa_marcada") Object.assign(upd, { talk_at: new Date(day(2).setHours(19, 30, 0, 0)).toISOString(), talk_with: "Pr. Marcos" });
  if (["ncc", "apresentacao", "concluido"].includes(p.stage)) Object.assign(upd, { talk_at: day(-30).toISOString(), talk_with: "Pr. Marcos", talk_done_at: day(-28).toISOString(), ncc_class: "Domingo 9h · Sala 2" });
  if (Object.keys(upd).length) ok(await admin.from("member_journeys").update(upd).eq("id", j.id));
  const n = p.stage === "ncc" ? 3 : ["apresentacao", "concluido"].includes(p.stage) ? lessons.length : 0;
  if (n) ok(await admin.from("ncc_attendance").insert(lessons.slice(0, n).map((l) => ({ journey_id: j.id, lesson_id: l.id, church_id: cid }))));
  if (p.stage === "apresentacao") ok(await admin.from("member_journeys").update({ presentation_date: dateOnly(day(10)) }).eq("id", j.id));
  if (p.stage === "concluido") ok(await admin.from("member_journeys").update({ presentation_date: dateOnly(day(-3)), presented_at: day(-3).toISOString() }).eq("id", j.id));
}
console.log(`Trilha de exemplo: ${PEOPLE.length} pessoas (login do visitante: visitante@demo.com / demo12345).`);
