-- =====================================================================
-- Transmissão ao vivo e devocionais no site da igreja.
-- =====================================================================

alter table public.churches
  add column live_url   text,                          -- link da live (YouTube) ou do canal
  add column live_on    boolean not null default false, -- "estamos ao vivo agora"
  add column live_title text;

create table public.devotionals (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  publish_on  date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  title       text not null check (length(title) between 3 and 140),
  verse_ref   text,               -- ex.: Salmos 23:1
  verse_text  text,
  body        text not null,
  prayer      text,               -- oração do dia
  author      text,
  image_url   text,
  published   boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index on public.devotionals (church_id, publish_on desc);

alter table public.devotionals enable row level security;
-- Público (site) lê os publicados até hoje; a liderança vê e edita tudo, inclusive os agendados.
create policy devotionals_public on public.devotionals for select
  using (published and publish_on <= (now() at time zone 'America/Sao_Paulo')::date);
create policy devotionals_staff on public.devotionals for all
  using (public.is_staff(church_id)) with check (public.is_staff(church_id));

-- Ligar/desligar o "ao vivo": liderança ou equipe de mídia (sem precisar ser admin da igreja).
create or replace function public.live_can_manage(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff(p_church) or exists (
    select 1 from ministry_members mm
    join ministries mi on mi.id = mm.ministry_id and mi.kind = 'midia' and mi.active
    join people pe on pe.id = mm.person_id
    where mm.church_id = p_church and pe.user_id = auth.uid()
  );
$$;
grant execute on function public.live_can_manage to authenticated;

create or replace function public.set_live(p_church uuid, p_on boolean, p_url text default null, p_title text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.live_can_manage(p_church) then raise exception 'Sem permissão'; end if;
  update churches set live_on = p_on,
    live_url = coalesce(nullif(trim(p_url), ''), live_url),
    live_title = case when p_title is null then live_title else nullif(trim(p_title), '') end
  where id = p_church;
end $$;
revoke execute on function public.set_live from public, anon;
grant execute on function public.set_live to authenticated;
