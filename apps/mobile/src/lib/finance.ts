import { supabase } from './supabase';

export type EntryType = 'entrada' | 'saida';
export type Entry = {
  id: string; type: EntryType; status: 'pago' | 'pendente'; entry_date: string; due_date: string | null;
  amount_cents: number; description: string; category: { name: string } | null;
};
export type Category = { id: string; name: string; type: EntryType };
export type Account = { id: string; name: string; kind: string; opening_cents: number };

export const todayBR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const addDays = (d: string, n: number) => {
  const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10);
};
export const fmtDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

/** Resumo do mês: mesmas contas do painel (saldo = inicial + entradas pagas − saídas pagas). */
export async function loadFinance(churchId: string) {
  const today = todayBR();
  const monthStart = today.slice(0, 8) + '01';
  await supabase.rpc('payroll_generate', { p_church: churchId }); // salários do mês em Contas a pagar
  const [acc, paid, month, due, last, cats] = await Promise.all([
    supabase.from('finance_accounts').select('id, name, kind, opening_cents').eq('church_id', churchId).eq('active', true).order('name'),
    supabase.from('finance_entries').select('account_id, type, amount_cents').eq('church_id', churchId).eq('status', 'pago'),
    supabase.from('finance_entries').select('type, amount_cents').eq('church_id', churchId).eq('status', 'pago').gte('entry_date', monthStart).lte('entry_date', today),
    supabase.from('finance_entries').select('id, type, status, entry_date, due_date, amount_cents, description, category:finance_categories(name)')
      .eq('church_id', churchId).eq('status', 'pendente').eq('type', 'saida').lte('due_date', addDays(today, 15)).order('due_date').limit(8),
    supabase.from('finance_entries').select('id, type, status, entry_date, due_date, amount_cents, description, category:finance_categories(name)')
      .eq('church_id', churchId).eq('status', 'pago').order('entry_date', { ascending: false }).order('created_at', { ascending: false }).limit(8),
    supabase.from('finance_categories').select('id, name, type').eq('church_id', churchId).eq('active', true).order('name'),
  ]);
  const accounts = (acc.data ?? []) as Account[];
  const balance = new Map(accounts.map((a) => [a.id, Number(a.opening_cents)]));
  for (const e of (paid.data ?? []) as { account_id: string | null; type: EntryType; amount_cents: number }[]) {
    if (e.account_id && balance.has(e.account_id)) balance.set(e.account_id, balance.get(e.account_id)! + (e.type === 'entrada' ? 1 : -1) * Number(e.amount_cents));
  }
  let income = 0, expense = 0;
  for (const e of (month.data ?? []) as { type: EntryType; amount_cents: number }[]) {
    if (e.type === 'entrada') income += Number(e.amount_cents); else expense += Number(e.amount_cents);
  }
  return {
    ok: !acc.error,
    accounts: accounts.map((a) => ({ ...a, balance: balance.get(a.id) ?? 0 })),
    total: [...balance.values()].reduce((a, b) => a + b, 0),
    income, expense,
    due: (due.data ?? []) as unknown as Entry[],
    last: (last.data ?? []) as unknown as Entry[],
    categories: (cats.data ?? []) as Category[],
    today,
  };
}
export type FinanceData = Awaited<ReturnType<typeof loadFinance>>;

/** Sobe o comprovante para o bucket privado `finance` (mesmo formato do painel). */
export async function uploadReceipt(churchId: string, uri: string, mime = 'image/jpeg') {
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const path = `${churchId}/${todayBR().slice(0, 7)}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from('finance').upload(path, body, { contentType: mime });
  if (error) throw error;
  return path;
}
