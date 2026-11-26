// Exemplo de chamada dos cultos: 8 domingos com presença e contagem do público.
import { createRequire } from "node:module";
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const SB_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const admin = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ok = ({ data, error }) => { if (error) throw error; return data; };

const { id: cid } = ok(await admin.from("churches").select("id").eq("slug", "gileade").single());
if (ok(await admin.from("services").select("id").eq("church_id", cid).limit(1)).length) {
  console.log("Presença já tem dados — nada a fazer.");
  process.exit(0);
}
const people = ok(await admin.from("people").select("id, full_name").eq("church_id", cid));
const P = (n) => people.find((p) => p.full_name.startsWith(n))?.id;

// Quantos dos 8 domingos cada um veio (do mais recente para trás)
const pattern = {
  "Pr. Marcos": 8, Maria: 8, Bruno: 7, Daniel: 8, Isabela: 6, Gabriela: 5, Felipe: 4, "Tiago e Lara": 8,
  "Carlos Mendes": 6, "Beatriz Alves": 5, "Juliana Prado": 3, "Elisa Martins": 2, "Hugo Pires": 1,
  "Fernanda Gomes": -2, // veio só em dois domingos antigos (sumiu)
};
// Domingos passados (o mais recente primeiro)
const now = new Date();
const lastSunday = new Date(now); lastSunday.setDate(now.getDate() - ((now.getDay() + 7) % 7 || 7));
const sundays = Array.from({ length: 8 }, (_, i) => new Date(lastSunday.getTime() - i * 7 * 864e5).toISOString().slice(0, 10));

let marks = 0;
for (const [i, day] of sundays.entries()) {
  const svc = ok(await admin.from("services").insert({ church_id: cid, service_date: day, title: "Culto da Família", headcount: 95 + ((i * 7) % 23) }).select("id").single());
  const rows = [];
  for (const [n, k] of Object.entries(pattern)) {
    const id = P(n);
    const came = k >= 0 ? i < k : i >= 8 + k; // negativo = só os mais antigos
    if (id && came) rows.push({ service_id: svc.id, person_id: id, church_id: cid });
  }
  ok(await admin.from("service_attendance").insert(rows));
  marks += rows.length;
}
console.log(`Presença de exemplo: ${sundays.length} cultos, ${marks} presenças.`);
