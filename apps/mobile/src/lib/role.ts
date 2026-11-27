import { useChurch } from './session';
import { supabase } from './supabase';
import { useData } from './use-data';

export type Role = 'owner' | 'admin' | 'leader' | 'treasurer' | 'member';

export type Me = {
  role: Role | null;
  status: string | null; // situação no cadastro: visitante, membro, novo_convertido…
  firstName: string;
  isStaff: boolean;      // pastor, administrador ou líder
  canFinance: boolean;   // pastor, administrador ou tesoureiro
  isVisitor: boolean;
};

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Pastor', admin: 'Administração', leader: 'Liderança', treasurer: 'Tesouraria', member: 'Membro',
};
export const roleLabel = (r: Role | null) => (r ? ROLE_LABEL[r] : '');

/** Primeiro nome; com título (Pr., Pra., Dr.) mantém o título junto: "Pr. Marcos". */
function shortName(full: string) {
  const w = full.trim().split(/\s+/).filter(Boolean);
  if (w.length > 1 && /^(pr|pra|pb|dr|dra|ev|miss|ap|bispo|pastora?)\.?$/i.test(w[0])) return `${w[0]} ${w[1]}`;
  return w[0] ?? '';
}

/** Quem é a pessoa nesta igreja: decide o que o Início mostra. */
export function useMe(): Me {
  const { church, user, personId } = useChurch();
  const { data } = useData(async () => {
    const [m, p] = await Promise.all([
      supabase.from('memberships').select('role').eq('church_id', church.id).eq('user_id', user.id).maybeSingle(),
      personId ? supabase.from('people').select('full_name, status').eq('id', personId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    return {
      role: (m.data?.role ?? null) as Role | null,
      status: (p.data as { status?: string } | null)?.status ?? null,
      name: (p.data as { full_name?: string } | null)?.full_name ?? null,
    };
  }, { role: null, status: null, name: null }, `me:${church.id}:${user.id}:${personId}`);

  const full = data.name ?? (user.user_metadata?.full_name as string | undefined) ?? '';
  const role = data.role;
  return {
    role,
    status: data.status,
    firstName: shortName(full),
    isStaff: role === 'owner' || role === 'admin' || role === 'leader',
    canFinance: role === 'owner' || role === 'admin' || role === 'treasurer',
    isVisitor: data.status === 'visitante',
  };
}

/** Endereço do site da igreja (Bíblia, ao vivo, devocional, painel). */
export const siteBase = () =>
  typeof window !== 'undefined' && window.location?.origin?.startsWith('http') ? window.location.origin : 'https://comunhao-psi.vercel.app';
