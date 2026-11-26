// Cria uma cobrança (doação ou inscrição paga) no Asaas e registra em `payments`.
// Doações podem ser anônimas (site público); inscrições exigem login e ser o dono da inscrição.
import { adminClient, cors, json, requestUser } from "../_shared/util.ts";
import { createCharge, findOrCreateCustomer, pixQrCode, type BillingType } from "../_shared/asaas.ts";

const METHODS: Record<string, BillingType> = { pix: "PIX", boleto: "BOLETO", cartao: "CREDIT_CARD" };
const FEE = Number(Deno.env.get("PLATFORM_FEE_PERCENT") ?? "2");

function validCpf(raw: string) {
  const c = raw.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  for (const t of [9, 10]) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== Number(c[t])) return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  try {
    const body = await req.json();
    const { church_id, kind, method, name } = body as Record<string, string>;
    const cpf = String(body.cpf ?? "").replace(/\D/g, "");
    if (!church_id || !["doacao", "inscricao"].includes(kind)) return json({ error: "requisição inválida" }, 400);
    if (!METHODS[method]) return json({ error: "forma de pagamento inválida" }, 400);
    if (!name?.trim() || !validCpf(cpf)) return json({ error: "informe nome e CPF válidos" }, 400);

    const db = adminClient();
    const user = await requestUser(req);

    const { data: church } = await db
      .from("churches").select("id, name, active, payment_wallet_id").eq("id", church_id).maybeSingle();
    if (!church?.active) return json({ error: "igreja não encontrada" }, 404);

    let amountCents: number;
    let description: string;
    let fundId: string | null = null;
    let registrationId: string | null = null;

    if (kind === "doacao") {
      amountCents = Math.round(Number(body.amount_cents));
      if (!Number.isFinite(amountCents) || amountCents < 500 || amountCents > 10_000_000) {
        return json({ error: "valor entre R$ 5,00 e R$ 100.000,00" }, 400);
      }
      const { data: fund } = await db
        .from("donation_funds").select("id, name").eq("id", body.fund_id).eq("church_id", church_id).eq("active", true)
        .maybeSingle();
      if (!fund) return json({ error: "fundo de doação inválido" }, 400);
      fundId = fund.id;
      description = `${fund.name} - ${church.name}`;
    } else {
      if (!user) return json({ error: "faça login" }, 401);
      const { data: reg } = await db
        .from("registrations").select("id, status, user_id, church_id, events(title, price_cents)")
        .eq("id", body.registration_id).maybeSingle();
      // deno-lint-ignore no-explicit-any
      const ev = (reg as any)?.events;
      if (!reg || reg.user_id !== user.id || reg.church_id !== church_id) return json({ error: "inscrição inválida" }, 404);
      if (reg.status !== "pendente") return json({ error: "inscrição não está pendente de pagamento" }, 409);
      amountCents = ev.price_cents;
      description = `Inscrição: ${ev.title}`;
      registrationId = reg.id;
    }

    const { data: payment, error: insErr } = await db.from("payments").insert({
      church_id, user_id: user?.id ?? null, kind, fund_id: fundId, registration_id: registrationId,
      amount_cents: amountCents, method, payer_name: name.trim(),
    }).select("id").single();
    if (insErr) throw insErr;

    const customer = await findOrCreateCustomer(name.trim(), cpf, user?.email ?? undefined);
    const charge = await createCharge({
      customer, billingType: METHODS[method], valueCents: amountCents, description,
      externalReference: payment.id, splitWalletId: church.payment_wallet_id, platformFeePercent: FEE,
    });

    const update: Record<string, unknown> = { provider_id: charge.id, invoice_url: charge.invoiceUrl };
    if (method === "pix") {
      const qr = await pixQrCode(charge.id);
      update.pix_payload = qr.payload;
      update.pix_qr_base64 = qr.encodedImage;
    }
    await db.from("payments").update(update).eq("id", payment.id);

    return json({
      payment_id: payment.id,
      invoice_url: charge.invoiceUrl,
      pix_payload: update.pix_payload ?? null,
      pix_qr_base64: update.pix_qr_base64 ?? null,
    });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "erro inesperado" }, 500);
  }
});
