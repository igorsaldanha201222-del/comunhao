import { siteBase } from './role';
import { supabase } from './supabase';

/** Pede ao servidor para enviar um aviso (o envio usa a chave que só o servidor tem). */
export async function sendNotify(body: { church_id: string; kind: 'aviso' | 'confirmacao'; title?: string; body?: string; service_id?: string }) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Faça login de novo.');
  const res = await fetch(`${siteBase()}/api/app/notify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const out = (await res.json().catch(() => ({}))) as { error?: string; sent?: number; total?: number };
  if (!res.ok) throw new Error(out.error ?? 'Não deu para enviar.');
  return { sent: out.sent ?? 0, total: out.total ?? 0 };
}
