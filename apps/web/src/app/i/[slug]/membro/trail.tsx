import { date, dateTime } from "@/lib/format";
import { level, maxXp, STEPS, stepsDone, xp, XP_NCC_LESSON, type Journey } from "@/lib/journey";

type Lesson = { id: string; title: string };

/** Trilha em formato de "tabuleiro": cada etapa é uma casa; a atual pulsa. */
export function Trail({ journey, lessons, attended }: { journey: Journey | null; lessons: Lesson[]; attended: Set<string> }) {
  const done = journey ? stepsDone(journey) : -1; // -1 = ainda não começou
  const nccDone = lessons.filter((l) => attended.has(l.id)).length;
  const points = journey ? xp(journey, nccDone) : 0;
  const total = maxXp(lessons.length);

  const detail = (i: number) => {
    if (!journey) return null;
    if (i === 1) {
      if (journey.talk_done_at) return `Conversa feita em ${date(journey.talk_done_at)} ✔`;
      if (journey.talk_at) return `📅 Marcada para ${dateTime(journey.talk_at)}${journey.talk_with ? ` com ${journey.talk_with}` : ""}`;
      return "A liderança vai entrar em contato para marcar o melhor dia.";
    }
    if (i === 2 && done >= 2) {
      return journey.ncc_done_at ? `Curso concluído em ${date(journey.ncc_done_at)} ✔` : `${nccDone} de ${lessons.length} encontros${journey.ncc_class ? ` · Turma: ${journey.ncc_class}` : ""}`;
    }
    if (i === 3 && done >= 3) {
      if (journey.presented_at) return `Apresentado(a) em ${date(journey.presented_at)} ✔`;
      return journey.presentation_date ? `🗓 Sua apresentação: culto de ${date(journey.presentation_date)}` : "A data da apresentação será combinada com você.";
    }
    return null;
  };

  return (
    <div>
      {journey && (
        <div className="mb-6 rounded-2xl bg-white p-5 shadow-[0_5px_20px_rgba(0,0,0,0.06)]">
          <div className="flex items-baseline justify-between">
            <p className="text-sm text-zinc-500">Nível</p>
            <p className="text-sm font-semibold text-brand">{points} / {total} pontos</p>
          </div>
          <p className="text-2xl font-extrabold">{done >= 4 ? "🏆 " : "⭐ "}{level(journey)}</p>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.round((points / total) * 100)}%` }} />
          </div>
        </div>
      )}

      <ol className="relative space-y-4 before:absolute before:top-6 before:bottom-6 before:left-7 before:w-1 before:rounded before:bg-zinc-200">
        {STEPS.map((s, i) => {
          const state = i < done || (done >= 4) ? "ok" : i === done ? "now" : "locked";
          const d = detail(i);
          return (
            <li key={s.key} className="relative flex gap-4">
              <span className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl ring-4 ring-zinc-50 ${
                state === "ok" ? "bg-emerald-500" : state === "now" ? "animate-pulse bg-brand" : "bg-zinc-200 grayscale"}`}>
                {state === "ok" ? "✅" : state === "locked" ? "🔒" : s.icon}
              </span>
              <div className={`min-w-0 flex-1 rounded-2xl p-4 ${state === "now" ? "border-2 border-brand bg-white shadow-lg" : "bg-white/70"} ${state === "locked" ? "opacity-60" : ""}`}>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Etapa {i + 1}{state === "now" ? " · você está aqui" : ""}
                  <span className="float-right text-brand">+{i === 2 ? `${XP_NCC_LESSON}/encontro` : s.xp}</span>
                </p>
                <p className="font-bold">{s.title}</p>
                <p className="text-sm text-zinc-600">{s.text}</p>
                {d && <p className="mt-2 rounded-lg bg-zinc-50 px-3 py-2 text-sm font-medium">{d}</p>}
                {i === 2 && lessons.length > 0 && (
                  <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {lessons.map((l, n) => {
                      const ok = attended.has(l.id);
                      return (
                        <li key={l.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${ok ? "bg-emerald-50 text-emerald-800" : "bg-zinc-50 text-zinc-500"}`}>
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ok ? "bg-emerald-500 text-white" : "bg-zinc-200"}`}>{ok ? "✓" : n + 1}</span>
                          <span className="truncate">{l.title}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
        <li className="relative flex gap-4">
          <span className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl ring-4 ring-zinc-50 ${done >= 4 ? "bg-amber-400" : "bg-zinc-200 grayscale"}`}>🏆</span>
          <div className={`flex-1 rounded-2xl p-4 ${done >= 4 ? "bg-amber-50 font-bold text-amber-900" : "bg-white/70 text-zinc-400"}`}>
            {done >= 4 ? "Bem-vindo(a) à família! Agora você é membro. 🎊" : "Membro da igreja"}
          </div>
        </li>
      </ol>
    </div>
  );
}
