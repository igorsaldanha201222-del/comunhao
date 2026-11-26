// Exemplo para a tela de Engajamento: batismos, presença em evento e dízimos ligados às pessoas.
import { createRequire } from "node:module";
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const SB_URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const admin = createClient(SB_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ok = ({ data, error }) => { if (error) throw error; return data; };

const { id: cid } = ok(await admin.from("churches").select("id").eq("slug", "gileade").single());
if (ok(await admin.from("finance_entries").select("id").eq("church_id", cid).not("person_id", "is", null).limit(1)).length) {
  console.log("Engajamento já tem dados — nada a fazer.");
  process.exit(0);
}
const day = (n) => new Date(Date.now() + n * 864e5);
const d = (n) => day(n).toISOString().slice(0, 10);

// Membros que andam afastados (não servem, não vão a eventos, não contribuem)
ok(await admin.from("people").insert([
  { church_id: cid, full_name: "Roberto Silva", status: "membro", phone: "(85) 98811-2001", baptized_at: "2015-04-12" },
  { church_id: cid, full_name: "Fernanda Gomes", status: "membro", phone: "(85) 98811-2002" },
  { church_id: cid, full_name: "Marcelo Dias", status: "membro", phone: "(85) 98811-2003", baptized_at: "2019-10-06" },
  { church_id: cid, full_name: "Patrícia Lopes", status: "novo_convertido", phone: "(85) 98811-2004" },
]));
const people = ok(await admin.from("people").select("id, full_name, user_id").eq("church_id", cid));
const P = (n) => people.find((p) => p.full_name.startsWith(n));

// Batismos
const baptisms = { "Pr. Marcos": "1998-01-18", Maria: "2010-06-20", Bruno: "2014-03-09", Daniel: "2017-11-12", Isabela: "2021-08-15", "Tiago e Lara": "2026-11-23" };
for (const [n, at] of Object.entries(baptisms)) ok(await admin.from("people").update({ baptized_at: at }).eq("id", P(n).id));

// Evento que já aconteceu, com inscrições e check-in
const ev = ok(await admin.from("events").insert({
  church_id: cid, title: "Conferência da Família", starts_at: day(-20).toISOString(), ends_at: day(-20).toISOString(), published: true,
}).select("id").single());
for (const n of ["Pr. Marcos", "Maria", "Tiago e Lara", "Carlos Mendes"]) {
  const p = P(n);
  if (!p.user_id) continue;
  ok(await admin.from("registrations").insert({
    church_id: cid, event_id: ev.id, user_id: p.user_id, name: p.full_name, status: "confirmada", checked_in_at: day(-20).toISOString(), created_at: day(-30).toISOString(),
  }));
}

// Dízimos ligados à pessoa (lançados pelo tesoureiro)
const cat = ok(await admin.from("finance_categories").select("id, name").eq("church_id", cid).eq("type", "entrada"))
  .find((c) => /d[íi]zimo/i.test(c.name));
const acc = ok(await admin.from("finance_accounts").select("id").eq("church_id", cid).limit(1))[0];
const givers = { "Pr. Marcos": [6, 90000], Maria: [6, 35000], Bruno: [4, 42000], Gabriela: [3, 15000], Daniel: [2, 28000], "Tiago e Lara": [1, 30000] };
const rows = [];
for (const [n, [months, cents]] of Object.entries(givers)) {
  for (let m = 0; m < months; m++) {
    rows.push({ church_id: cid, type: "entrada", status: "pago", entry_date: d(-5 - m * 30), amount_cents: cents, description: "Dízimo",
      category_id: cat?.id ?? null, account_id: acc?.id ?? null, counterparty: P(n).full_name, payment_method: "pix", person_id: P(n).id });
  }
}
ok(await admin.from("finance_entries").insert(rows));
console.log(`Engajamento de exemplo: ${Object.keys(baptisms).length} batismos, 1 evento, ${rows.length} dízimos, 4 membros afastados.`);
