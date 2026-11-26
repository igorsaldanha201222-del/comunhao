"use client";
import { useState } from "react";
import { ActionForm, Submit } from "@/components/form";
import { Field } from "@/components/ui";
import { saveEntry } from "./actions";

export type Opt = { id: string; name: string; type?: string };
export type Entry = {
  id: string; type: string; status: string; entry_date: string; due_date: string | null; amount_cents: number;
  description: string; category_id: string | null; account_id: string | null; counterparty: string | null;
  counterparty_doc: string | null; document_type: string | null; document_number: string | null;
  payment_method: string | null; notes: string | null; source: string; attachment_path: string | null;
};

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Formulário de lançamento: muda rótulos e categorias conforme entrada/saída. */
export function EntryForm({ slug, categories, accounts, entry }: { slug: string; categories: Opt[]; accounts: Opt[]; entry?: Entry }) {
  const [type, setType] = useState(entry?.type ?? "saida");
  const [status, setStatus] = useState(entry?.status ?? "pago");
  const online = entry?.source === "online";
  const cats = categories.filter((c) => c.type === type);
  const isOut = type === "saida";

  return (
    <ActionForm action={saveEntry} reset={!entry} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="slug" value={slug} />
      {entry && <input type="hidden" name="id" value={entry.id} />}

      <div className="grid grid-cols-2 gap-2 sm:col-span-2">
        {(["saida", "entrada"] as const).map((t) => (
          <label key={t} className={`cursor-pointer rounded-lg border p-2 text-center text-sm font-medium ${type === t ? (t === "saida" ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800") : "border-zinc-300"} ${online ? "pointer-events-none opacity-60" : ""}`}>
            <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
            {t === "saida" ? "− Saída (despesa)" : "+ Entrada (receita)"}
          </label>
        ))}
      </div>

      <Field label="Descrição" className="sm:col-span-2">
        <input name="description" required defaultValue={entry?.description} placeholder={isOut ? "ex.: Conta de energia de novembro" : "ex.: Oferta do culto de domingo"} className="input" />
      </Field>
      <Field label="Valor (R$)">
        <input name="amount" required inputMode="decimal" readOnly={online} placeholder="0,00"
          defaultValue={entry ? (entry.amount_cents / 100).toFixed(2).replace(".", ",") : ""} className="input text-right tabular-nums" />
      </Field>
      <Field label="Situação">
        <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} disabled={online} className="input">
          <option value="pago">{isOut ? "Pago" : "Recebido"}</option>
          <option value="pendente">{isOut ? "A pagar" : "A receber"}</option>
        </select>
      </Field>
      <Field label={status === "pago" ? (isOut ? "Data do pagamento" : "Data do recebimento") : "Data de lançamento"}>
        <input name="entry_date" type="date" required readOnly={online} defaultValue={entry?.entry_date ?? today()} className="input" />
      </Field>
      <Field label="Vencimento">
        <input name="due_date" type="date" defaultValue={entry?.due_date ?? ""} className="input" />
      </Field>
      <Field label="Categoria">
        <select name="category_id" defaultValue={entry?.category_id ?? ""} key={type} className="input">
          <option value="">—</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="Conta">
        <select name="account_id" defaultValue={entry?.account_id ?? ""} className="input">
          <option value="">—</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label={isOut ? "Fornecedor / favorecido" : "Recebido de"}>
        <input name="counterparty" defaultValue={entry?.counterparty ?? ""} className="input" />
      </Field>
      <Field label="CPF / CNPJ">
        <input name="counterparty_doc" defaultValue={entry?.counterparty_doc ?? ""} className="input" />
      </Field>
      <Field label="Forma de pagamento">
        <select name="payment_method" defaultValue={entry?.payment_method ?? ""} className="input">
          <option value="">—</option>
          <option value="dinheiro">Dinheiro</option>
          <option value="pix">Pix</option>
          <option value="transferencia">Transferência</option>
          <option value="boleto">Boleto</option>
          <option value="cartao">Cartão</option>
          <option value="debito_automatico">Débito automático</option>
          <option value="cheque">Cheque</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Documento">
          <select name="document_type" defaultValue={entry?.document_type ?? ""} className="input">
            <option value="">—</option>
            <option value="nota_fiscal">Nota fiscal</option>
            <option value="recibo">Recibo</option>
            <option value="cupom">Cupom fiscal</option>
            <option value="boleto">Boleto</option>
            <option value="fatura">Fatura</option>
            <option value="outro">Outro</option>
          </select>
        </Field>
        <Field label="Número">
          <input name="document_number" defaultValue={entry?.document_number ?? ""} className="input" />
        </Field>
      </div>
      <Field label={entry?.attachment_path ? "Substituir nota/comprovante (PDF ou foto)" : "Nota / comprovante (PDF ou foto)"} className="sm:col-span-2">
        <input name="attachment" type="file" accept="application/pdf,image/*" capture="environment" className="text-sm" />
      </Field>
      <Field label="Observações" className="sm:col-span-2">
        <textarea name="notes" rows={2} defaultValue={entry?.notes ?? ""} className="input" />
      </Field>
      {online && <p className="text-xs text-zinc-500 sm:col-span-2">Lançamento gerado por pagamento online: valor, data e situação vêm do gateway.</p>}
      <div className="sm:col-span-2"><Submit>{entry ? "Salvar alterações" : "Registrar lançamento"}</Submit></div>
    </ActionForm>
  );
}
