// Renomeia a igreja de demonstração já criada (esperanca -> gileade) sem apagar os dados.
import { createRequire } from "node:module";
const require = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const admin = createClient(process.env.SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ok = ({ data, error }) => { if (error) throw error; return data; };

const PASTOR = "Pr. Marcos Sérgio Pinheiro de Oliveira";
const church = ok(await admin.from("churches").select("id").in("slug", ["esperanca", "gileade"]).limit(1).single());
ok(await admin.from("churches").update({
  name: "Gileade Cidade dos Funcionários", slug: "gileade", address: "Cidade dos Funcionários",
  city: "Fortaleza", state: "CE", instagram: "@gileadecf",
}).eq("id", church.id));
const pastor = ok(await admin.auth.admin.listUsers()).users.find((u) => u.email === "pastor@demo.com");
ok(await admin.auth.admin.updateUserById(pastor.id, { user_metadata: { full_name: PASTOR } }));
ok(await admin.from("profiles").update({ full_name: PASTOR }).eq("id", pastor.id));
ok(await admin.from("people").update({ full_name: PASTOR }).eq("church_id", church.id).eq("user_id", pastor.id));
ok(await admin.from("sermons").update({ preacher: PASTOR }).eq("church_id", church.id));
ok(await admin.from("prayer_requests").update({ author_name: PASTOR }).eq("church_id", church.id).eq("user_id", pastor.id));
console.log("Igreja renomeada para Gileade Cidade dos Funcionários (código: gileade).");
