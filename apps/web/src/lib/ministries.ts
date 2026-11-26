// "Cara" de cada tipo de ministério: rótulos e quais recursos aparecem.
export const MINISTRY_KINDS = {
  louvor: { label: "Louvor", icon: "🎵", repertoire: true, scheduleWord: "Escala de louvor" },
  diaconato: { label: "Diaconato", icon: "🤝", repertoire: false, scheduleWord: "Escala de diáconos" },
  midia: { label: "Mídia", icon: "🎥", repertoire: false, scheduleWord: "Escala de mídia" },
  recepcao: { label: "Recepção", icon: "👋", repertoire: false, scheduleWord: "Escala de recepção" },
  kids: { label: "Kids", icon: "🧸", repertoire: false, scheduleWord: "Escala do kids" },
  intercessao: { label: "Intercessão", icon: "🙏", repertoire: false, scheduleWord: "Escala de oração" },
  ensino: { label: "Ensino", icon: "📖", repertoire: false, scheduleWord: "Escala de aulas" },
  outro: { label: "Outro", icon: "⭐", repertoire: false, scheduleWord: "Escala" },
} as const;

export type MinistryKind = keyof typeof MINISTRY_KINDS;
export const kindOf = (k: string) => MINISTRY_KINDS[(k as MinistryKind) in MINISTRY_KINDS ? (k as MinistryKind) : "outro"];

export const KEYS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B", "Cm", "C#m", "Dm", "Ebm", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "Bbm", "Bm"];
