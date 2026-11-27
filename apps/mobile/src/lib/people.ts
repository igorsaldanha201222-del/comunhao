import { C } from '@/components/ui';

export type PersonStatus = 'visitante' | 'novo_convertido' | 'membro' | 'inativo';

export const STATUS: Record<PersonStatus, { label: string; color: string; bg: string }> = {
  membro: { label: 'Membro', color: C.ok, bg: C.tint },
  visitante: { label: 'Visitante', color: C.accentText, bg: C.accentTint },
  novo_convertido: { label: 'Novo convertido', color: '#2f5fa8', bg: '#e8eef8' },
  inativo: { label: 'Inativo', color: C.muted, bg: '#eef0ee' },
};

/** dd/mm/aaaa → aaaa-mm-dd (ou null). */
export function toISODate(v: string) {
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
export const fromISODate = (v: string | null) => (v ? v.slice(0, 10).split('-').reverse().join('/') : '');
