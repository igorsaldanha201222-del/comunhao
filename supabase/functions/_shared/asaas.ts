// Cliente mínimo da API do Asaas (gateway brasileiro: Pix, boleto e cartão).
// ASAAS_API_URL: https://api-sandbox.asaas.com/v3 (testes) ou https://api.asaas.com/v3 (produção)

const API = Deno.env.get("ASAAS_API_URL") ?? "https://api-sandbox.asaas.com/v3";
const KEY = Deno.env.get("ASAAS_API_KEY") ?? "";

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "access_token": KEY, "User-Agent": "comunhao-saas" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.errors?.map((e: { description: string }) => e.description).join("; ") ?? res.statusText;
    throw new Error(`Asaas: ${msg}`);
  }
  return data as T;
}

export type BillingType = "PIX" | "BOLETO" | "CREDIT_CARD";

export async function findOrCreateCustomer(name: string, cpfCnpj: string, email?: string) {
  const found = await call<{ data: { id: string }[] }>("GET", `/customers?cpfCnpj=${cpfCnpj}`);
  if (found.data?.length) return found.data[0].id;
  const c = await call<{ id: string }>("POST", "/customers", { name, cpfCnpj, email });
  return c.id;
}

export async function createCharge(opts: {
  customer: string;
  billingType: BillingType;
  valueCents: number;
  description: string;
  externalReference: string;
  splitWalletId?: string | null;
  platformFeePercent: number;
}) {
  const due = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
  const body: Record<string, unknown> = {
    customer: opts.customer,
    billingType: opts.billingType,
    value: opts.valueCents / 100,
    dueDate: due,
    description: opts.description,
    externalReference: opts.externalReference,
  };
  // Repasse automático para a carteira da igreja; a plataforma retém a taxa.
  if (opts.splitWalletId) {
    body.split = [{ walletId: opts.splitWalletId, percentualValue: 100 - opts.platformFeePercent }];
  }
  return call<{ id: string; invoiceUrl: string; status: string }>("POST", "/payments", body);
}

export function pixQrCode(paymentId: string) {
  return call<{ encodedImage: string; payload: string; expirationDate: string }>(
    "GET",
    `/payments/${paymentId}/pixQrCode`,
  );
}
