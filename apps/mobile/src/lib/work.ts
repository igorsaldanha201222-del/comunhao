import { supabase } from './supabase';

export type Punch = { id: string; kind: 'entrada' | 'saida'; at: string; source: string };
const TZ = 'America/Sao_Paulo';
export const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const hhmm = (v: string) => new Date(v).toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
export const hours = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;
const dayKey = (v: string | Date) => new Date(v).toLocaleDateString('en-CA', { timeZone: TZ });

/** Minutos trabalhados: soma dos pares entrada → saída (com saída em aberto contando até agora). */
export function worked(ps: Punch[], now = Date.now()) {
  let total = 0, open: number | null = null;
  for (const p of [...ps].sort((a, b) => a.at.localeCompare(b.at))) {
    const t = new Date(p.at).getTime();
    if (p.kind === 'entrada') open = t;
    else if (open !== null) { total += (t - open) / 60000; open = null; }
  }
  return { total: total + (open !== null ? (now - open) / 60000 : 0), working: open !== null };
}

/** Batidas do mês do funcionário, separadas em hoje e no mês. */
export async function loadPunches(employeeId: string) {
  const today = dayKey(new Date());
  const from = new Date(`${today.slice(0, 8)}01T00:00:00-03:00`).toISOString();
  const { data } = await supabase.from('time_punches').select('id, kind, at, source').eq('employee_id', employeeId).gte('at', from).order('at');
  const all = (data ?? []) as Punch[];
  const byDay = new Map<string, Punch[]>();
  for (const p of all) byDay.set(dayKey(p.at), [...(byDay.get(dayKey(p.at)) ?? []), p]);
  const todayList = byDay.get(today) ?? [];
  const monthMin = [...byDay.entries()].reduce((a, [d, ps]) => a + (d === today ? worked(ps).total : worked(ps, 0).total), 0);
  return { today: todayList, monthDays: byDay.size, monthMin };
}
