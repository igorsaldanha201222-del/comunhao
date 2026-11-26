// Popula o Supabase LOCAL com uma igreja de demonstração.
// Uso: node scripts/seed-demo.mjs  (a partir de app_igreja/, com `supabase start` rodando)
import { createRequire } from "node:module";
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const SB_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ANON || !SERVICE) throw new Error("Defina SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY (veja `npx supabase status`).");
if (!process.env.ALLOW_REMOTE && !SB_URL.includes("127.0.0.1") && !SB_URL.includes("localhost")) throw new Error("Seed só roda no Supabase local.");

const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
const PASS = "demo12345";

async function user(email, full_name) {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true, user_metadata: { full_name } });
  if (error && !/already/i.test(error.message)) throw error;
  if (data?.user) return data.user.id;
  const { data: list } = await admin.auth.admin.listUsers();
  return list.users.find((u) => u.email === email).id;
}
async function as(email) {
  const c = createClient(SB_URL, ANON, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw error;
  return c;
}
const ok = ({ data, error }) => { if (error) throw error; return data; };

const pastorId = await user("pastor@demo.com", "Pr. Marcos Sérgio Pinheiro de Oliveira");
const tesId = await user("tesoureiro@demo.com", "Carla Souza");
const memId = await user("membro@demo.com", "Maria Oliveira");
const p = await as("pastor@demo.com");

let church = ok(await admin.from("churches").select("*").eq("slug", "gileade").maybeSingle());
if (!church) church = ok(await p.rpc("create_church", { p_name: "Gileade Cidade dos Funcionários", p_slug: "gileade" }));
const cid = church.id;
ok(await p.from("churches").update({
  primary_color: "#0f766e", about: "Uma família que ama a Deus e serve a cidade.", address: "Cidade dos Funcionários",
  city: "Fortaleza", state: "CE", phone: "(85) 99999-0000", instagram: "@gileadecf",
}).eq("id", cid));

for (const [email] of [["tesoureiro@demo.com"], ["membro@demo.com"]]) ok(await (await as(email)).rpc("join_church", { p_slug: "gileade" }));
ok(await admin.from("memberships").update({ role: "treasurer" }).eq("church_id", cid).eq("user_id", tesId));
ok(await admin.from("people").update({ status: "membro" }).eq("church_id", cid).eq("user_id", memId));

// Pessoas
const names = ["Ana Lima", "Bruno Castro", "Daniel Rocha", "Elisa Martins", "Felipe Nunes", "Gabriela Reis", "Hugo Pires", "Isabela Costa"];
const existing = ok(await p.from("people").select("full_name").eq("church_id", cid)).map((x) => x.full_name);
const toAdd = names.filter((n) => !existing.includes(n)).map((n, i) => ({
  church_id: cid, full_name: n, phone: `(85) 98888-00${10 + i}`, status: i % 3 === 0 ? "visitante" : "membro",
  birth_date: `19${80 + i}-0${(i % 9) + 1}-1${i}`,
}));
if (toAdd.length) ok(await p.from("people").insert(toAdd));
const people = ok(await p.from("people").select("id, full_name").eq("church_id", cid));
const pid = (n) => people.find((x) => x.full_name === n).id;

// Ministérios
async function ministry(kind, name, color) {
  const found = ok(await p.from("ministries").select("id").eq("church_id", cid).eq("name", name).maybeSingle());
  if (found) return found.id;
  return ok(await p.from("ministries").insert({ church_id: cid, kind, name, color }).select("id").single()).id;
}
const louvor = await ministry("louvor", "Louvor", "#7c3aed");
const diac = await ministry("diaconato", "Diaconato", "#0369a1");
await ministry("midia", "Mídia", "#c2410c");
const pos = ok(await p.from("ministry_positions").select("id, name, ministry_id").in("ministry_id", [louvor, diac]));
const P = (m, n) => pos.find((x) => x.ministry_id === m && x.name === n).id;
ok(await p.from("ministry_members").upsert([
  { ministry_id: louvor, person_id: pid("Maria Oliveira"), church_id: cid, is_leader: true, position_ids: [P(louvor, "Ministro"), P(louvor, "Vocal")] },
  { ministry_id: louvor, person_id: pid("Bruno Castro"), church_id: cid, is_leader: false, position_ids: [P(louvor, "Violão")] },
  { ministry_id: louvor, person_id: pid("Daniel Rocha"), church_id: cid, is_leader: false, position_ids: [P(louvor, "Bateria")] },
  { ministry_id: louvor, person_id: pid("Gabriela Reis"), church_id: cid, is_leader: false, position_ids: [P(louvor, "Teclado"), P(louvor, "Vocal")] },
  { ministry_id: diac, person_id: pid("Felipe Nunes"), church_id: cid, is_leader: true, position_ids: [P(diac, "Santa Ceia")] },
  { ministry_id: diac, person_id: pid("Hugo Pires"), church_id: cid, is_leader: false, position_ids: [P(diac, "Porta")] },
]));
const songs = [["Grande é o Senhor", "Adhemar de Campos", "G", 72], ["Bondade de Deus", "Isaías Saad", "A", 68], ["Lugar Secreto", "Gabriela Rocha", "D", 74], ["Ninguém Explica Deus", "Preto no Branco", "E", 80]];
const haveSongs = ok(await p.from("songs").select("title").eq("church_id", cid)).map((s) => s.title);
const newSongs = songs.filter(([t]) => !haveSongs.includes(t));
if (newSongs.length) ok(await p.from("songs").insert(newSongs.map(([title, artist, song_key, bpm]) => ({ church_id: cid, ministry_id: louvor, title, artist, song_key, bpm }))));

const nextSunday = new Date(); nextSunday.setDate(nextSunday.getDate() + ((7 - nextSunday.getDay()) % 7 || 7));
const sunday = nextSunday.toISOString().slice(0, 10);
let sched = ok(await p.from("schedules").select("id").eq("ministry_id", louvor).eq("title", "Culto da Família").maybeSingle());
if (!sched) {
  sched = ok(await p.from("schedules").insert({ ministry_id: louvor, church_id: cid, title: "Culto da Família", starts_at: `${sunday}T18:00:00-03:00` }).select("id").single());
  ok(await p.from("schedule_assignments").insert([
    { schedule_id: sched.id, church_id: cid, person_id: pid("Maria Oliveira"), position_id: P(louvor, "Ministro"), status: "pendente" },
    { schedule_id: sched.id, church_id: cid, person_id: pid("Bruno Castro"), position_id: P(louvor, "Violão"), status: "confirmado" },
    { schedule_id: sched.id, church_id: cid, person_id: pid("Daniel Rocha"), position_id: P(louvor, "Bateria"), status: "confirmado" },
  ]));
  const s = ok(await p.from("songs").select("id, title").eq("ministry_id", louvor));
  ok(await p.from("schedule_songs").insert(s.slice(0, 3).map((x, i) => ({ schedule_id: sched.id, song_id: x.id, church_id: cid, position: i }))));
  const d = ok(await p.from("schedules").insert({ ministry_id: diac, church_id: cid, title: "Santa Ceia", starts_at: `${sunday}T18:00:00-03:00` }).select("id").single());
  ok(await p.from("schedule_assignments").insert({ schedule_id: d.id, church_id: cid, person_id: pid("Bruno Castro"), position_id: P(diac, "Porta") }));
}

// Comunicação e eventos
if (!ok(await p.from("sermons").select("id").eq("church_id", cid)).length) {
  ok(await p.from("sermons").insert([
    { church_id: cid, title: "A fé que move montanhas", preacher: "Pr. Marcos Sérgio Pinheiro de Oliveira", series: "Fé em ação", video_url: null, preached_at: "2026-11-23" },
    { church_id: cid, title: "Servir com alegria", preacher: "Pr. Marcos Sérgio Pinheiro de Oliveira", series: "Fé em ação", video_url: null, preached_at: "2026-11-16" },
  ]));
  ok(await p.from("events").insert([
    { church_id: cid, title: "Retiro de Jovens", description: "Três dias de comunhão, louvor e palavra.", location: "Sítio Bela Vista", starts_at: "2027-01-16T08:00:00-03:00", capacity: 80, price_cents: 18000, published: true },
    { church_id: cid, title: "Culto de Natal", description: "Cantata e ceia com toda a família.", location: "Templo sede", starts_at: "2026-12-24T19:00:00-03:00", price_cents: 0, published: true },
  ]));
  ok(await p.from("prayer_requests").insert({ church_id: cid, user_id: pastorId, author_name: "Pr. Marcos Sérgio Pinheiro de Oliveira", category: "Família", body: "Pela saúde da irmã Ana, que fará cirurgia na próxima semana." }));
}

// Financeiro (como tesoureira)
const t = await as("tesoureiro@demo.com");
if (!ok(await t.from("finance_entries").select("id").eq("church_id", cid)).length) {
  const cats = ok(await t.from("finance_categories").select("id, name, type").eq("church_id", cid));
  const accs = ok(await t.from("finance_accounts").select("id, kind").eq("church_id", cid));
  const C = (type, n) => cats.find((c) => c.type === type && c.name === n).id;
  const A = (k) => accs.find((a) => a.kind === k).id;
  ok(await t.from("finance_accounts").update({ opening_cents: 1250000 }).eq("id", A("banco")));
  const ym = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }).slice(0, 7);
  const d = (day) => `${ym}-${String(day).padStart(2, "0")}`;
  ok(await t.from("finance_entries").insert([
    { church_id: cid, type: "entrada", status: "pago", entry_date: d(2), amount_cents: 842000, description: "Dízimos do culto de domingo", category_id: C("entrada", "Dízimo"), account_id: A("banco"), payment_method: "pix", created_by: tesId },
    { church_id: cid, type: "entrada", status: "pago", entry_date: d(2), amount_cents: 131550, description: "Oferta em espécie — culto de domingo", category_id: C("entrada", "Oferta"), account_id: A("caixa"), payment_method: "dinheiro", document_type: "recibo", document_number: "0451", notes: "Contado por Carla e Felipe", created_by: tesId },
    { church_id: cid, type: "entrada", status: "pago", entry_date: d(9), amount_cents: 765000, description: "Dízimos do culto de domingo", category_id: C("entrada", "Dízimo"), account_id: A("banco"), payment_method: "pix", created_by: tesId },
    { church_id: cid, type: "saida", status: "pago", entry_date: d(5), amount_cents: 350000, description: "Aluguel do templo", category_id: C("saida", "Aluguel"), account_id: A("banco"), counterparty: "Imobiliária Centro", counterparty_doc: "12.345.678/0001-90", payment_method: "transferencia", document_type: "recibo", document_number: "11/2026", created_by: tesId },
    { church_id: cid, type: "saida", status: "pago", entry_date: d(10), amount_cents: 48790, description: "Conta de energia", category_id: C("saida", "Energia elétrica"), account_id: A("banco"), counterparty: "Enel CE", payment_method: "boleto", document_type: "fatura", document_number: "883120", created_by: tesId },
    { church_id: cid, type: "saida", status: "pago", entry_date: d(12), amount_cents: 21540, description: "Produtos de limpeza", category_id: C("saida", "Material de limpeza"), account_id: A("caixa"), counterparty: "Atacadão", payment_method: "dinheiro", document_type: "cupom", document_number: "77812", created_by: tesId },
    { church_id: cid, type: "saida", status: "pendente", entry_date: d(20), due_date: d(25), amount_cents: 12990, description: "Internet do templo", category_id: C("saida", "Internet/Telefone"), account_id: A("banco"), counterparty: "Provedor Net", document_type: "boleto", created_by: tesId },
  ]));
}

// Energia solar: aparelho + um dia de leituras simuladas
if (!ok(await p.from("solar_devices").select("id").eq("church_id", cid)).length) {
  const [dev] = ok(await p.rpc("create_solar_device", { p_church: cid, p_name: "Inversor do telhado", p_brand: "Huawei", p_model: "SUN2000-10KTL", p_kw: 10 }));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const rows = [];
  let energy = 0;
  for (let m = 6 * 60; m <= Math.min(18 * 60, new Date().getUTCHours() * 60 - 180 + new Date().getUTCMinutes()); m += 10) {
    const x = (m - 6 * 60) / (12 * 60);
    const w = Math.max(0, Math.sin(Math.PI * x)) * 8200 * (0.9 + 0.1 * Math.sin(m / 7));
    energy += (w / 1000) * (10 / 60);
    const hh = String(Math.floor(m / 60)).padStart(2, "0"), mm = String(m % 60).padStart(2, "0");
    rows.push({ device_id: dev.device_id, church_id: cid, measured_at: `${today}T${hh}:${mm}:00-03:00`, power_w: Math.round(w), energy_today_kwh: +energy.toFixed(2), status_code: 512, fault_code: 0 });
  }
  if (rows.length) ok(await admin.from("solar_readings").insert(rows));
  const last = rows.at(-1);
  ok(await admin.from("solar_devices").update({ last_seen_at: new Date().toISOString(), last_power_w: last?.power_w ?? 0, last_status: last?.power_w ? "gerando" : "parado" }).eq("id", dev.device_id));
  console.log("Token do medidor demo:", dev.device_token);
}

console.log(`
Pronto! Igreja de demonstração "Gileade Cidade dos Funcionários" (código: gileade)
  Pastor (administrador): pastor@demo.com     / ${PASS}
  Tesoureira:             tesoureiro@demo.com / ${PASS}
  Membro (líder louvor):  membro@demo.com     / ${PASS}`);
