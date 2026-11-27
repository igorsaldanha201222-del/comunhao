-- =====================================================================
-- Notificações no app instalado pelo navegador (Web Push: Android e
-- iPhone com iOS 16.4+ quando adicionado à tela de início).
-- =====================================================================

create table public.web_push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  church_id  uuid not null references public.churches(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index on public.web_push_subscriptions (church_id);

alter table public.web_push_subscriptions enable row level security;
create policy web_push_self on public.web_push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(church_id));

-- Envio de um aviso: a liderança "trava" a notificação (evita envio duplo) e recebe os destinos.
-- Roda como security definer para a liderança não precisar ler as inscrições dos outros diretamente.
create or replace function public.notification_dispatch(p_notification uuid)
returns table (kind text, endpoint text, p256dh text, auth text) language plpgsql security definer set search_path = public as $$
declare n notifications;
begin
  select * into n from notifications where id = p_notification;
  if n.id is null or not public.is_staff(n.church_id) then raise exception 'Sem permissão'; end if;
  update notifications set sent_at = now() where id = n.id and sent_at is null;
  if not found then raise exception 'Essa notificação já foi enviada'; end if;
  return query
    select 'web'::text, w.endpoint, w.p256dh, w.auth from web_push_subscriptions w where w.church_id = n.church_id
    union all
    select 'expo'::text, t.token, null::text, null::text from push_tokens t where t.church_id = n.church_id;
end $$;
revoke execute on function public.notification_dispatch from public, anon;
grant execute on function public.notification_dispatch to authenticated;

-- Resultado do envio: conta e limpa aparelhos que não existem mais.
create or replace function public.notification_result(p_notification uuid, p_sent int, p_dead text[])
returns void language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select church_id into c from notifications where id = p_notification;
  if c is null or not public.is_staff(c) then raise exception 'Sem permissão'; end if;
  update notifications set sent_count = p_sent where id = p_notification;
  delete from web_push_subscriptions where church_id = c and endpoint = any(coalesce(p_dead, '{}'));
  delete from push_tokens where church_id = c and token = any(coalesce(p_dead, '{}'));
end $$;
revoke execute on function public.notification_result from public, anon;
grant execute on function public.notification_result to authenticated;
