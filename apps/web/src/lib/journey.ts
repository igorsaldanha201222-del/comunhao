// Trilha "Quero ser membro" — etapas e pontuação (o "jogo").
export type Journey = {
  id: string; full_name: string; phone: string | null; motivation: string | null;
  step: "conversa" | "ncc" | "apresentacao" | "concluido";
  talk_at: string | null; talk_with: string | null; talk_done_at: string | null;
  ncc_class: string | null; ncc_done_at: string | null;
  presentation_date: string | null; presented_at: string | null; gave_up: boolean; created_at: string;
};

export const STEPS = [
  { key: "inicio", icon: "🙋", title: "Quero ser membro", text: "Você deu o primeiro passo!", xp: 100 },
  { key: "conversa", icon: "☕", title: "Conversa com o pastor", text: "Um bate-papo para te conhecer, ouvir sua história e tirar dúvidas.", xp: 200 },
  { key: "ncc", icon: "📖", title: "NCC — Núcleo de Crescimento Cristão", text: "Curso de alinhamento: encontros sobre a fé e sobre a nossa igreja.", xp: 0 },
  { key: "apresentacao", icon: "🎉", title: "Apresentação à igreja", text: "Você é apresentado(a) no culto e recebido(a) como membro!", xp: 300 },
] as const;
export const XP_NCC_LESSON = 50;

const ORDER = { conversa: 1, ncc: 2, apresentacao: 3, concluido: 4 } as const;
/** Índice (0..4) de quantas etapas da trilha já foram vencidas. */
export const stepsDone = (j: Pick<Journey, "step">) => ORDER[j.step];

export function xp(j: Pick<Journey, "step">, nccDone: number) {
  const n = stepsDone(j);
  return STEPS[0].xp + (n >= 2 ? STEPS[1].xp : 0) + nccDone * XP_NCC_LESSON + (n >= 4 ? STEPS[3].xp : 0);
}
export const maxXp = (nccTotal: number) => STEPS[0].xp + STEPS[1].xp + nccTotal * XP_NCC_LESSON + STEPS[3].xp;

export function level(j: Pick<Journey, "step">) {
  return (["", "Visitante", "Caminhante", "Discípulo", "Membro"] as const)[stepsDone(j)];
}
