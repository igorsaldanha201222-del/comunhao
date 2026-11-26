// Recebe eventos de pagamento do Asaas e atualiza `payments` e `registrations`.
// Configure no painel do Asaas a URL desta função e o mesmo token de ASAAS_WEBHOOK_TOKEN.
import { adminClient, json } from "../_shared/util.ts";

const STATUS: Record<string, string> = {
  PAYMENT_RECEIVED: "pago",
  PAYMENT_CONFIRMED: "pago",
  PAYMENT_OVERDUE: "cancelado",
  PAYMENT_DELETED: "cancelado",
  PAYMENT_REFUNDED: "estornado",
  PAYMENT_CHARGEBACK_REQUESTED: "estornado",
  PAYMENT_CREDIT_CARD_CAPTURE_REFUSED: "falhou",
};

Deno.serve(async (req) => {
  const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  if (!expected || req.headers.get("asaas-access-token") !== expected) return json({ error: "não autorizado" }, 401);

  const evt = await req.json().catch(() => null);
  const status = STATUS[evt?.event];
  const providerId = evt?.payment?.id;
  if (!status || !providerId) return json({ ignored: true }); // 200 para o Asaas não reenviar

  const db = adminClient();
  const { data: pay } = await db
    .from("payments").select("id, status, registration_id").eq("provider_id", providerId).maybeSingle();
  if (!pay) return json({ ignored: true });
  if (pay.status === status) return json({ ok: true }); // idempotente

  await db.from("payments").update({
    status,
    paid_at: status === "pago" ? new Date().toISOString() : null,
  }).eq("id", pay.id);

  if (pay.registration_id) {
    const regStatus = status === "pago" ? "confirmada" : status === "estornado" ? "cancelada" : null;
    if (regStatus) await db.from("registrations").update({ status: regStatus }).eq("id", pay.registration_id);
  }
  return json({ ok: true });
});
