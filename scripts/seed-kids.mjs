// Dados de exemplo do Ministério Kids (rode depois do seed-demo.mjs).
import { createRequire } from "node:module";
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const SB_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const admin = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ok = ({ data, error }) => { if (error) throw error; return data; };
async function as(email) {
  const c = createClient(SB_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  ok(await c.auth.signInWithPassword({ email, password: "demo12345" }));
  return c;
}

const { id: cid } = ok(await admin.from("churches").select("id").eq("slug", "gileade").single());
if (ok(await admin.from("kids_children").select("id").eq("church_id", cid)).length) {
  console.log("Kids já tem dados — nada a fazer.");
  process.exit(0);
}
const pastor = await as("pastor@demo.com");
const maria = await as("membro@demo.com");

// Ministério Kids com duas professoras
let kmin = ok(await pastor.from("ministries").select("id").eq("church_id", cid).eq("kind", "kids").maybeSingle());
if (!kmin) kmin = ok(await pastor.from("ministries").insert({ church_id: cid, kind: "kids", name: "Kids", color: "#f59e0b" }).select("id").single());
const people = ok(await pastor.from("people").select("id, full_name").eq("church_id", cid).in("full_name", ["Elisa Martins", "Isabela Costa"]));
if (people.length) ok(await pastor.from("ministry_members").upsert(people.map((p, i) => ({ ministry_id: kmin.id, person_id: p.id, church_id: cid, is_leader: i === 0, position_ids: [] }))));

const y = new Date().getFullYear();
// Filhos da Maria (cadastrados por ela no app)
const lucas = ok(await maria.rpc("kids_register_child", { p_church: cid, p_name: "Lucas Oliveira", p_birth: `${y - 7}-03-14`, p_allergies: "Amendoim", p_relationship: "Mãe" }));
const sofia = ok(await maria.rpc("kids_register_child", { p_church: cid, p_name: "Sofia Oliveira", p_birth: `${y - 4}-08-02`, p_relationship: "Mãe" }));
// Outras crianças cadastradas pela equipe
const others = ok(await pastor.from("kids_children").insert([
  { church_id: cid, full_name: "Pedro Lima", birth_date: `${y - 2}-01-20`, medical_notes: "Usa chupeta, avisar se chorar muito." },
  { church_id: cid, full_name: "Ana Clara Castro", birth_date: `${y - 10}-11-05` },
  { church_id: cid, full_name: "Miguel Rocha", birth_date: `${y - 6}-06-30`, allergies: "Lactose" },
]).select("id, full_name"));
ok(await pastor.from("kids_guardians").insert([
  { child_id: others[0].id, church_id: cid, name: "Ana Lima", phone: "(85) 98888-0010", relationship: "Mãe" },
  { child_id: others[1].id, church_id: cid, name: "Bruno Castro", phone: "(85) 98888-0011", relationship: "Pai" },
  { child_id: others[2].id, church_id: cid, name: "Daniel Rocha", phone: "(85) 98888-0012", relationship: "Pai" },
  { child_id: others[2].id, church_id: cid, name: "Dona Lúcia", phone: "(85) 98888-0099", relationship: "Avó" },
]));

// Hoje: Pedro e Ana Clara na sala, Miguel já retirado, Sofia com pré-check-in pelo app
for (const k of [others[0], others[1], others[2]]) ok(await pastor.rpc("kids_checkin", { p_child: k.id }));
const miguel = ok(await pastor.from("kids_checkins").select("id, security_code").eq("child_id", others[2].id).single());
ok(await pastor.rpc("kids_checkout", { p_checkin: miguel.id, p_code: miguel.security_code, p_picked_up_by: "Dona Lúcia (avó)" }));
ok(await maria.rpc("kids_precheckin", { p_child: sofia.id }));
void lucas;

// Aulas
const rooms = ok(await pastor.from("kids_rooms").select("id, name").eq("church_id", cid));
const room = (n) => rooms.find((r) => r.name === n)?.id ?? null;
const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const lastWeek = new Date(Date.now() - 7 * 864e5).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
ok(await pastor.from("kids_lessons").insert([
  {
    church_id: cid, room_id: room("Kids"), lesson_date: today, title: "Davi e Golias — coragem que vem de Deus",
    bible_verse: "“O Senhor é a minha força e o meu escudo” — Salmos 28:7",
    plan: "9h00 — Acolhida e louvor (“Meu Deus é tão grande”)\n9h15 — História: Davi enfrenta o gigante (1 Samuel 17)\n9h35 — Atividade: funda de papel e 5 pedrinhas\n9h50 — Lanche\n10h00 — Oração: cada criança fala um medo e entregamos a Deus",
    home_activity: "Conversem sobre um medo que seu filho tem e orem juntos pedindo coragem. Peça para ele desenhar o Davi e trazer no próximo domingo!",
    materials: "Papel color set, cola, barbante, pedrinhas lisas", published: true,
  },
  {
    church_id: cid, room_id: null, lesson_date: lastWeek, title: "A criação: Deus fez tudo com amor",
    bible_verse: "“No princípio, Deus criou os céus e a terra” — Gênesis 1:1",
    plan: "Louvor, história dos 7 dias com fantoches, massinha: modelar animais.",
    home_activity: "Façam um passeio e anotem 5 coisas que Deus criou. Agradeçam a Deus por cada uma.",
    published: true,
  },
]));
console.log("Kids de exemplo criado: 5 crianças, check-ins de hoje e 2 aulas.");
