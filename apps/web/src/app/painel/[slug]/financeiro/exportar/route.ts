import { NextResponse, type NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/format";

// CSV do mês para o contador (separador ; e vírgula decimal, abre direto no Excel em pt-BR).
export async function GET(request: NextRequest, { params }: RouteContext<"/painel/[slug]/financeiro/exportar">) {
  const { slug } = await params;
  const { church, supabase, canFinance } = await requireStaff(slug);
  if (!canFinance) return new NextResponse("Sem acesso", { status: 403 });

  const mes = request.nextUrl.searchParams.get("mes") ?? "";
  if (!/^\d{4}-\d{2}$/.test(mes)) return new NextResponse("Mês inválido", { status: 400 });
  const [y, m] = mes.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);

  const { data } = await supabase.from("finance_entries")
    .select("entry_date, due_date, type, status, description, amount_cents, counterparty, counterparty_doc, document_type, document_number, payment_method, notes, attachment_path, finance_categories(name), finance_accounts(name)")
    .eq("church_id", church.id).gte("entry_date", `${mes}-01`).lt("entry_date", to).order("entry_date");

  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // Evita injeção de fórmula ao abrir no Excel.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return /[;"\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const header = ["Data", "Vencimento", "Tipo", "Situação", "Descrição", "Categoria", "Conta", "Valor", "Fornecedor/Origem", "CPF/CNPJ", "Documento", "Nº", "Forma", "Anexo", "Observações"];
  const lines = (data ?? []).map((r) => {
    const cents = Number(r.amount_cents) * (r.type === "saida" ? -1 : 1);
    return [
      r.entry_date, r.due_date, STATUS_LABEL[r.type], r.status, r.description,
      (r.finance_categories as unknown as { name: string } | null)?.name, (r.finance_accounts as unknown as { name: string } | null)?.name,
      (cents / 100).toFixed(2).replace(".", ","), r.counterparty, r.counterparty_doc,
      r.document_type ? STATUS_LABEL[r.document_type] : "", r.document_number,
      r.payment_method ? STATUS_LABEL[r.payment_method] ?? r.payment_method : "", r.attachment_path ? "sim" : "não", r.notes,
    ].map(esc).join(";");
  });

  const csv = "﻿" + [header.join(";"), ...lines].join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="financeiro-${slug}-${mes}.csv"`,
    },
  });
}
