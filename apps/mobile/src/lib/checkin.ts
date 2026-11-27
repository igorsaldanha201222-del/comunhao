import { supabase } from './supabase';

/** Data de hoje no fuso de Brasília (AAAA-MM-DD). */
export const todayBR = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export type TodayService = { id: string; title: string; present: boolean };

/** Culto de hoje (o indicado ou o mais recente aberto) e se a pessoa já está na lista. */
export async function todayService(churchId: string, personId: string | null, serviceId?: string): Promise<TodayService | null> {
  let q = supabase.from('services').select('id, title').eq('church_id', churchId).eq('service_date', todayBR());
  if (serviceId) q = q.eq('id', serviceId);
  const { data } = await q.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  let present = false;
  if (personId) {
    const { count } = await supabase.from('service_attendance').select('person_id', { count: 'exact', head: true })
      .eq('service_id', data.id).eq('person_id', personId);
    present = (count ?? 0) > 0;
  }
  return { id: data.id, title: data.title, present };
}
