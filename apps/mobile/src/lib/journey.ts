import { supabase } from '@/lib/supabase';

// Trilha "Quero ser membro" — mesmas regras do site (apps/web/src/lib/journey.ts).
export type Journey = {
  id: string; step: 'conversa' | 'ncc' | 'apresentacao' | 'concluido';
  talk_at: string | null; talk_with: string | null; talk_done_at: string | null;
  ncc_class: string | null; ncc_done_at: string | null;
  presentation_date: string | null; presented_at: string | null;
};

export const STEPS = [
  { icon: '🙋', title: 'Quero ser membro', text: 'Você deu o primeiro passo!', xp: 100 },
  { icon: '☕', title: 'Conversa com o pastor', text: 'Um bate-papo para te conhecer e tirar dúvidas.', xp: 200 },
  { icon: '📖', title: 'NCC — Núcleo de Crescimento Cristão', text: 'Curso de alinhamento: encontros sobre a fé e a igreja.', xp: 0 },
  { icon: '🎉', title: 'Apresentação à igreja', text: 'Você é apresentado(a) no culto e recebido(a) como membro!', xp: 300 },
] as const;
export const XP_NCC_LESSON = 50;
const ORDER = { conversa: 1, ncc: 2, apresentacao: 3, concluido: 4 } as const;
export const stepsDone = (j: Pick<Journey, 'step'>) => ORDER[j.step];
export const xp = (j: Pick<Journey, 'step'>, ncc: number) => {
  const n = stepsDone(j);
  return STEPS[0].xp + (n >= 2 ? STEPS[1].xp : 0) + ncc * XP_NCC_LESSON + (n >= 4 ? STEPS[3].xp : 0);
};
export const maxXp = (nccTotal: number) => STEPS[0].xp + STEPS[1].xp + nccTotal * XP_NCC_LESSON + STEPS[3].xp;
export const level = (j: Pick<Journey, 'step'>) => (['', 'Visitante', 'Caminhante', 'Discípulo', 'Membro'] as const)[stepsDone(j)];

export async function loadJourney(churchId: string, userId: string) {
  const [{ data: j }, { data: person }, { data: lessons }] = await Promise.all([
    supabase.from('member_journeys').select('id, step, talk_at, talk_with, talk_done_at, ncc_class, ncc_done_at, presentation_date, presented_at')
      .eq('church_id', churchId).eq('user_id', userId).maybeSingle(),
    supabase.from('people').select('status, phone').eq('church_id', churchId).eq('user_id', userId).maybeSingle(),
    supabase.from('ncc_lessons').select('id, title').eq('church_id', churchId).order('position'),
  ]);
  const { data: att } = j ? await supabase.from('ncc_attendance').select('lesson_id').eq('journey_id', j.id) : { data: [] };
  return {
    journey: j as Journey | null,
    isMember: person?.status === 'membro',
    phone: (person?.phone as string | null) ?? '',
    lessons: (lessons ?? []) as { id: string; title: string }[],
    attended: (att ?? []).map((a) => a.lesson_id as string),
  };
}
