// Recebe leituras do aparelho de monitoramento solar (ESP32/Arduino + RS485/Modbus).
// POST com header `x-device-token: <token>` e corpo JSON:
// { power_w, energy_today_kwh, energy_total_kwh, dc_voltage_v, ac_voltage_v,
//   temperature_c, status_code, fault_code }
import { adminClient, json } from "../_shared/util.ts";

const MIN_INTERVAL_MS = 30_000; // ignora envios mais frequentes que isso

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

function brasiliaHour(d = new Date()) {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }).format(d));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);
  const token = req.headers.get("x-device-token") ?? "";
  if (token.length < 32) return json({ error: "não autorizado" }, 401);

  const db = adminClient();
  const { data: dev } = await db
    .from("solar_devices").select("id, church_id, name, last_seen_at")
    .eq("token_hash", await sha256Hex(token)).maybeSingle();
  if (!dev) return json({ error: "não autorizado" }, 401);

  if (dev.last_seen_at && Date.now() - new Date(dev.last_seen_at).getTime() < MIN_INTERVAL_MS) {
    return json({ ok: true, throttled: true });
  }

  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return json({ error: "JSON inválido" }, 400);

  const r = {
    power_w: num(b.power_w),
    energy_today_kwh: num(b.energy_today_kwh),
    energy_total_kwh: num(b.energy_total_kwh),
    dc_voltage_v: num(b.dc_voltage_v),
    ac_voltage_v: num(b.ac_voltage_v),
    temperature_c: num(b.temperature_c),
    status_code: num(b.status_code),
    fault_code: num(b.fault_code),
  };
  const now = new Date().toISOString();

  await db.from("solar_readings").insert({ device_id: dev.id, church_id: dev.church_id, measured_at: now, ...r, raw: b });

  // Medidor online, mas o inversor não respondeu no RS485 (cabo, endereço ou paridade).
  const inverterMute = b.modbus_ok === 0;
  const fault = inverterMute || (r.fault_code ?? 0) !== 0;
  const status = fault ? "falha" : r.power_w && r.power_w > 0 ? "gerando" : "parado";
  await db.from("solar_devices").update({ last_seen_at: now, last_power_w: r.power_w, last_status: status }).eq("id", dev.id);

  // Alertas: abre/fecha conforme a leitura. O índice único impede alerta duplicado aberto.
  // Erro 23505 (já existe alerta aberto do mesmo tipo) é esperado e ignorado.
  const open = (kind: string, message: string) =>
    db.from("solar_alerts").insert({ device_id: dev.id, church_id: dev.church_id, kind, message });
  const resolve = (kind: string) =>
    db.from("solar_alerts").update({ resolved_at: now }).eq("device_id", dev.id).eq("kind", kind).is("resolved_at", null);

  await resolve("offline");
  if (inverterMute) await open("falha", "Medidor online, mas sem resposta do inversor (RS485)");
  else if (fault) await open("falha", `Inversor reportou falha (código ${r.fault_code})`);
  else await resolve("falha");

  const h = brasiliaHour();
  if (!fault && h >= 10 && h < 15 && (r.power_w ?? 0) <= 0) {
    await open("sem_geracao", "Sem geração em horário de sol (10h–15h)");
  } else if ((r.power_w ?? 0) > 0) {
    await resolve("sem_geracao");
  }

  return json({ ok: true });
});
