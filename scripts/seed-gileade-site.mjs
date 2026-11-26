// Dados institucionais e identidade visual da Gileade Cidade dos Funcionários (site atual da igreja).
// Uso: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-gileade-site.mjs
import { createRequire } from "node:module";
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const admin = createClient(process.env.SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ok = ({ data, error }) => { if (error) throw error; return data; };

const church = ok(await admin.from("churches").select("id").eq("slug", "gileade").single());
const cid = church.id;

/** Baixa uma imagem do site da igreja e guarda no bucket público `media`. */
async function mirror(url, name) {
  const r = await fetch(url);
  if (!r.ok) { console.log("  sem imagem:", url, r.status); return null; }
  const type = r.headers.get("content-type") ?? "image/jpeg";
  const path = `${cid}/marca/${name}`;
  ok(await admin.storage.from("media").upload(path, await r.arrayBuffer(), { contentType: type, upsert: true }));
  return admin.storage.from("media").getPublicUrl(path).data.publicUrl;
}

const hero = await mirror("https://igrejagileade.com.br/igreja/04.jpg", "hero.jpg");
ok(await admin.from("churches").update({
  name: "Gileade Cidade dos Funcionários",
  primary_color: "#008a38",
  accent_color: "#f06500",
  hero_url: hero,
  tagline: "Um lugar de fé, esperança e amor.",
  about: "Somos a Igreja Gileade Cidade dos Funcionários, uma família que busca a Deus, cuida das pessoas e serve a cidade de Fortaleza.",
  service_times: "Horários em atualização.",
  address: "Rua Teofredo Goiana, 735 - Cidade dos Funcionários",
  city: "Fortaleza", state: "CE",
  phone: "(85) 99604-9230",
  email: "marcossergiopinheiro@gmail.com",
  instagram: null,
  pix_key: null,
}).eq("id", cid));

const base = "https://sistema.igrejagileade.com/admin/carteira/";
const leaders = [
  { name: "Pr. Marcos Sérgio Pinheiro de Oliveira", title: "Pastor titular", bio: "Pastoreia a Igreja Gileade Cidade dos Funcionários há 6 anos.", file: "marcossergiopinheiro.png" },
  { name: "Pr. Reginaldo Ferreira", title: "Pastor auxiliar", bio: null, file: "antônioreginaldoferreirademorais.png" },
  { name: "Pr. Manoel Filho", title: "Pastor jubilado", bio: null, file: "manoeljoaquimfilho.png" },
];
ok(await admin.from("church_leaders").delete().eq("church_id", cid));
for (const [i, l] of leaders.entries()) {
  const photo = await mirror(base + encodeURIComponent(l.file), `lider-${i + 1}.png`);
  ok(await admin.from("church_leaders").insert({ church_id: cid, name: l.name, title: l.title, bio: l.bio, photo_url: photo, position: i + 1 }));
}
console.log("Site da Gileade atualizado (cores #008a38 / #f06500, foto do topo e liderança).");
