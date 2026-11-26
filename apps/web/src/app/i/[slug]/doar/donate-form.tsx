"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Result = { invoice_url: string; pix_payload: string | null; pix_qr_base64: string | null };
const PRESETS = [50, 100, 200, 500];

export function DonateForm({ churchId, funds }: { churchId: string; funds: { id: string; name: string }[] }) {
  const [amount, setAmount] = useState("100");
  const [method, setMethod] = useState<"pix" | "cartao" | "boleto">("pix");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const f = new FormData(e.currentTarget);
    const cents = Math.round(Number(amount.replace(/\./g, "").replace(",", ".")) * 100);
    const { data, error } = await createClient().functions.invoke("create-payment", {
      body: { church_id: churchId, kind: "doacao", fund_id: f.get("fund_id"), amount_cents: cents, method, name: f.get("name"), cpf: f.get("cpf") },
    });
    setBusy(false);
    if (error || data?.error) {
      let msg = data?.error;
      try { msg = msg ?? (await (error as { context?: Response }).context?.json())?.error; } catch {}
      setError(msg ?? "Não foi possível gerar a cobrança.");
      return;
    }
    if (method === "pix") setResult(data);
    else window.location.href = data.invoice_url; // cartão e boleto: página segura do gateway
  }

  if (result?.pix_payload) {
    return (
      <div className="card mt-6 text-center">
        <p className="font-medium">Pague com Pix</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${result.pix_qr_base64}`} alt="QR Code Pix" className="mx-auto mt-4 h-56 w-56" />
        <button className="btn-ghost mt-4 w-full" onClick={async () => { await navigator.clipboard.writeText(result.pix_payload!); setCopied(true); }}>
          {copied ? "Código copiado ✓" : "Copiar código Pix (copia e cola)"}
        </button>
        <p className="mt-4 text-sm text-zinc-500">Obrigado pela sua generosidade! A confirmação é automática.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block">
        <span className="label">Destino</span>
        <select name="fund_id" className="input">{funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
      </label>
      <div>
        <span className="label">Valor (R$)</span>
        <div className="mb-2 grid grid-cols-4 gap-2">
          {PRESETS.map((v) => (
            <button type="button" key={v} onClick={() => setAmount(String(v))}
              className={`rounded-lg border py-2 text-sm ${amount === String(v) ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"}`}>{v}</button>
          ))}
        </div>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required className="input" />
      </div>
      <div>
        <span className="label">Forma de pagamento</span>
        <div className="grid grid-cols-3 gap-2">
          {(["pix", "cartao", "boleto"] as const).map((m) => (
            <button type="button" key={m} onClick={() => setMethod(m)}
              className={`rounded-lg border py-2 text-sm ${method === m ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"}`}>
              {m === "pix" ? "Pix" : m === "cartao" ? "Cartão" : "Boleto"}
            </button>
          ))}
        </div>
      </div>
      <label className="block"><span className="label">Nome completo</span><input name="name" required className="input" /></label>
      <label className="block"><span className="label">CPF (exigido para emitir a cobrança)</span><input name="cpf" required inputMode="numeric" className="input" /></label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="btn-primary w-full py-3">{busy ? "Gerando…" : "Contribuir"}</button>
    </form>
  );
}
