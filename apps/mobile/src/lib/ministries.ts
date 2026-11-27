// Tipos de ministério (a "cara" de cada um) e utilidades do louvor.
export const MINISTRY_KINDS = {
  louvor: 'Louvor',
  diaconato: 'Diaconato',
  midia: 'Mídia',
  recepcao: 'Recepção',
  kids: 'Kids',
  intercessao: 'Intercessão',
  ensino: 'Ensino',
  outro: 'Outro',
} as const;
export type MinistryKind = keyof typeof MINISTRY_KINDS;

export const MINISTRY_COLORS = ['#007a3d', '#2f5fa8', '#7c3aed', '#c2410c', '#be185d', '#0e7490', '#a16207', '#475569'];

export const KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B', 'Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
