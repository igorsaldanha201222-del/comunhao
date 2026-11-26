const TZ = "America/Sao_Paulo";

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const date = (v: string | null | undefined) =>
  v ? new Date(v.length === 10 ? v + "T12:00:00" : v).toLocaleDateString("pt-BR", { timeZone: TZ }) : "—";

export const dateTime = (v: string | null | undefined) =>
  v
    ? new Date(v).toLocaleString("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" })
    : "—";

/** Valor para <input type="datetime-local"> no fuso de Brasília. */
export const toLocalInput = (v: string | null | undefined) => {
  if (!v) return "";
  const d = new Date(v);
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(d);
  return parts.replace(" ", "T");
};

/** Converte "2026-12-01T19:30" (hora de Brasília) para ISO UTC. */
export const fromLocalInput = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s ? new Date(`${s}:00-03:00`).toISOString() : null;
};

/** "1.234,56" ou "1234.56" -> centavos */
export const parseMoney = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/\s|R\$/g, "");
  if (!s) return 0;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

export const youtubeId = (url: string | null | undefined) => {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|live\/|shorts\/)([\w-]{11})/);
  return m?.[1] ?? null;
};

export const STATUS_LABEL: Record<string, string> = {
  visitante: "Visitante",
  novo_convertido: "Novo convertido",
  membro: "Membro",
  inativo: "Inativo",
  pendente: "Pendente",
  pago: "Pago",
  cancelado: "Cancelado",
  estornado: "Estornado",
  falhou: "Falhou",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  owner: "Responsável",
  admin: "Administrador",
  leader: "Líder",
  treasurer: "Tesoureiro",
  entrada: "Entrada",
  saida: "Saída",
  nota_fiscal: "Nota fiscal",
  recibo: "Recibo",
  cupom: "Cupom fiscal",
  fatura: "Fatura",
  outro: "Outro",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
  cheque: "Cheque",
  debito_automatico: "Débito automático",
  member: "Membro",
  pix: "Pix",
  cartao: "Cartão",
  boleto: "Boleto",
};

/** Hora da requisição (Server Components são renderizados por requisição). */
export const nowMs = () => Date.now();
