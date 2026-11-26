/** Idade em anos (ou meses, para bebês) a partir da data de nascimento. */
export function ageLabel(birth: string | null | undefined, nowMs: number) {
  if (!birth) return null;
  const b = new Date(birth + "T12:00:00");
  const now = new Date(nowMs);
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months--;
  if (months < 0) return null;
  if (months < 24) return `${months} ${months === 1 ? "mês" : "meses"}`;
  const years = Math.floor(months / 12);
  return `${years} anos`;
}

export const todayBR = (nowMs: number) => new Date(nowMs).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export type Attachment = { name: string; url: string };
