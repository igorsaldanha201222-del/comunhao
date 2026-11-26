// Chamados de manutenção de demonstração (rode depois do seed-demo.mjs).
import { createRequire } from "node:module";
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const SB_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ANON || !SERVICE) throw new Error("Defina SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.");
if (!process.env.ALLOW_REMOTE && !SB_URL.includes("127.0.0.1") && !SB_URL.includes("localhost")) throw new Error("Só no Supabase local.");
const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
const ok = ({ data, error }) => { if (error) throw error; return data; };
async function as(email) {
  const c = createClient(SB_URL, ANON, { auth: { persistSession: false } });
  ok(await c.auth.signInWithPassword({ email, password: "demo12345" }));
  return c;
}

const church = ok(await admin.from("churches").select("id").eq("slug", "gileade").single());
const cid = church.id;
const users = ok(await admin.auth.admin.listUsers()).users;
const uid = (e) => users.find((u) => u.email === e).id;

// Maria (membro) abre chamados; a tesoureira Carla também cuida da manutenção (exemplo de "zeladora").
ok(await admin.from("memberships").update({ maint_request: true }).eq("church_id", cid).eq("user_id", uid("membro@demo.com")));
ok(await admin.from("memberships").update({ maint_manage: true }).eq("church_id", cid).eq("user_id", uid("tesoureiro@demo.com")));

if (ok(await admin.from("maintenance_requests").select("id").eq("church_id", cid)).length) {
  console.log("Já existem chamados — nada a fazer.");
  process.exit(0);
}

// "Fotos" ilustrativas (SVG) para o quadro não ficar vazio.
const svg = (bg, emoji, text) => `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${bg}"/><text x="320" y="250" font-size="160" text-anchor="middle">${emoji}</text><text x="320" y="400" font-size="34" font-family="sans-serif" text-anchor="middle" fill="#333">${text}</text></svg>`;
async function photo(client, folder, s) {
  const path = `${cid}/${folder}/${Math.random().toString(36).slice(2)}.svg`;
  ok(await client.storage.from("maintenance").upload(path, new Blob([s], { type: "image/svg+xml" }), { contentType: "image/svg+xml" }));
  return path;
}

const maria = await as("membro@demo.com");
const pastor = await as("pastor@demo.com");
const mk = async (client, row, pics = []) => {
  const photos = [];
  for (const p of pics) photos.push(await photo(client, "demo", p));
  return ok(await client.from("maintenance_requests").insert({ church_id: cid, ...row, photos }).select("id").single()).id;
};

const a = await mk(maria, { title: "Lâmpadas queimadas no palco", location: "Templo", priority: "alta",
  description: "São 2 lâmpadas LED de 20W do lado esquerdo. Tem escada no depósito." }, [svg("#fef3c7", "💡", "Palco - lado esquerdo")]);
const b = await mk(maria, { title: "Torneira pingando", location: "Banheiros", priority: "normal",
  description: "Banheiro feminino, segunda pia. Precisa trocar o reparo." }, [svg("#dbeafe", "🚰", "Banheiro feminino")]);
const c = await mk(pastor, { title: "Ar-condicionado sem gelar", location: "Salão social", priority: "urgente",
  description: "Domingo tem casamento no salão. Chamar o técnico." }, [svg("#e0f2fe", "❄️", "Split 24.000 BTUs")]);
const d = await mk(pastor, { title: "Pintar a sala das crianças", location: "Salas de aula", priority: "baixa" });
const e = await mk(maria, { title: "Porta do depósito emperrando", location: "Área externa", priority: "normal" }, [svg("#f3e8ff", "🚪", "Depósito")]);

const carla = uid("tesoureiro@demo.com");
ok(await pastor.from("maintenance_requests").update({ status: "em_andamento", assigned_to: carla, due_date: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10) }).eq("id", a));
ok(await pastor.from("maintenance_requests").update({ status: "aguardando", assigned_to: uid("pastor@demo.com"), cost_cents: 45000 }).eq("id", c));
ok(await pastor.from("maintenance_updates").insert({ request_id: c, user_id: uid("pastor@demo.com"), body: "Técnico vem quinta às 14h. Orçamento R$ 450 (gás + limpeza)." }));
ok(await pastor.from("maintenance_requests").update({ status: "concluida", assigned_to: carla, resolution: "Trocado o reparo da torneira (R$ 18)." }).eq("id", b));
ok(await maria.from("maintenance_updates").insert({ request_id: b, user_id: uid("membro@demo.com"), body: "Ficou ótimo, obrigada! 🙏" }));
void d; void e;
console.log("Chamados de manutenção criados.");
