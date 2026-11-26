import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';

export type Church = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
};

type Ctx = {
  loading: boolean;
  session: Session | null;
  church: Church | null;
  personId: string | null;
  selectChurch: (c: Church | null) => void;
};

const SessionContext = createContext<Ctx | null>(null);
const KEY = 'igreja_atual';

/** Sessão do usuário + igreja selecionada (o app inteiro assume a cor e o nome dela). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [selected, setSelected] = useState<Church | null>(null);
  // personId guardado junto da chave usuário+igreja a que pertence
  const [person, setPerson] = useState<{ key: string; id: string | null } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  // Restaura a última igreja, conferindo se o usuário ainda é membro.
  useEffect(() => {
    const saved = userId ? localStorage.getItem(KEY) : null;
    if (!userId || !saved) return;
    const c = JSON.parse(saved) as Church;
    supabase.from('memberships').select('church_id').eq('church_id', c.id).eq('user_id', userId).maybeSingle()
      .then(({ data }) => setSelected(data ? c : null));
  }, [userId]);

  const church = userId ? selected : null;
  const personKey = userId && church ? `${userId}:${church.id}` : null;

  useEffect(() => {
    if (!personKey) return;
    const [uid, cid] = personKey.split(':');
    supabase.from('people').select('id').eq('church_id', cid).eq('user_id', uid).maybeSingle()
      .then(({ data }) => setPerson({ key: personKey, id: data?.id ?? null }));
  }, [personKey]);

  const selectChurch = (c: Church | null) => {
    if (c) localStorage.setItem(KEY, JSON.stringify(c));
    else localStorage.removeItem(KEY);
    setSelected(c);
  };

  const personId = person && person.key === personKey ? person.id : null;

  return (
    <SessionContext value={{ loading, session, church, personId, selectChurch }}>{children}</SessionContext>
  );
}

export function useSession() {
  const ctx = use(SessionContext);
  if (!ctx) throw new Error('useSession fora do SessionProvider');
  return ctx;
}

/** Igreja e usuário garantidos (telas dentro das abas). */
export function useChurch() {
  const { church, session, personId } = useSession();
  return { church: church!, user: session!.user, personId, color: church?.primary_color ?? '#4f46e5' };
}
