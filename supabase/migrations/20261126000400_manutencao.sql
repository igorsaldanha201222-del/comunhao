-- =====================================================================
-- Solicitações de manutenção (chamados com foto + quadro kanban)
--  * O pastor/admin libera, pessoa a pessoa, quem ABRE chamados e quem
--    CUIDA da manutenção (vê o quadro, atribui e move os cartões).
--  * Administradores sempre podem tudo.
--  * Quem recebe um chamado atribuído pode mover o próprio cartão.
-- =====================================================================

alter table public.memberships
  add column if not exists maint_request boolean not null default false,
  add column if not exists maint_manage  boolean not null default false;

create or replace function public.maint_can_manage(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where church_id = p_church and user_id = auth.uid()
                 and (role in ('owner','admin') or maint_manage));
$$;

create or replace function public.maint_can_request(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where church_id = p_church and user_id = auth.uid()
                 and (role in ('owner','admin') or maint_manage or maint_request));
$$;

create type public.maint_status   as enum ('aberta', 'em_andamento', 'aguardando', 'concluida', 'cancelada');
create type public.maint_priority as enum ('baixa', 'normal', 'alta', 'urgente');

create table public.maintenance_requests (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references public.churches(id) on delete cascade,
  number       int  not null,
  title        text not null check (length(title) between 3 and 120),
  description  text check (length(description) <= 4000),
  location     text check (length(location) <= 120),
  priority     public.maint_priority not null default 'normal',
  status       public.maint_status   not null default 'aberta',
  position     double precision not null default extract(epoch from now()),
  photos       text[] not null default '{}' check (cardinality(photos) <= 10),
  requested_by uuid references auth.users(id) on delete set null,
  assigned_to  uuid references auth.users(id) on delete set null,
  due_date     date,
  cost_cents   bigint check (cost_cents >= 0),
  resolution   text check (length(resolution) <= 4000),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (church_id, number)
);
create index on public.maintenance_requests (church_id, status, position);
create index on public.maintenance_requests (assigned_to);
create index on public.maintenance_requests (requested_by);

-- Linha do tempo: abertura, mudanças de etapa/responsável e comentários (com foto opcional).
create table public.maintenance_updates (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.maintenance_requests(id) on delete cascade,
  church_id   uuid not null references public.churches(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  kind        text not null default 'comentario' check (kind in ('criada','status','atribuicao','comentario')),
  body        text check (length(body) <= 4000),
  photo_path  text,
  created_at  timestamptz not null default now()
);
create index on public.maintenance_updates (request_id, created_at);

alter table public.maintenance_requests enable row level security;
alter table public.maintenance_updates  enable row level security;

-- Numeração por igreja (#1, #2…) e regras de quem muda o quê.
create or replace function public.maint_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare manager boolean := auth.role() = 'service_role' or public.maint_can_manage(new.church_id);
begin
  if tg_op = 'INSERT' then
    perform pg_advisory_xact_lock(hashtext('maint:' || new.church_id));
    new.number := coalesce((select max(number) from maintenance_requests where church_id = new.church_id), 0) + 1;
    if auth.role() <> 'service_role' then new.requested_by := auth.uid(); end if;
    if not manager then
      new.status := 'aberta'; new.assigned_to := null; new.cost_cents := null; new.resolution := null; new.due_date := null;
    end if;
  else
    if new.church_id is distinct from old.church_id or new.number is distinct from old.number
       or new.requested_by is distinct from old.requested_by then
      raise exception 'Campos fixos do chamado não podem mudar';
    end if;
    -- Quem não gerencia (o responsável atribuído) só move o cartão, comenta a solução e anexa fotos.
    if not manager and (
         new.title is distinct from old.title or new.description is distinct from old.description
      or new.location is distinct from old.location or new.priority is distinct from old.priority
      or new.assigned_to is distinct from old.assigned_to or new.due_date is distinct from old.due_date
      or new.cost_cents is distinct from old.cost_cents or new.status = 'cancelada') then
      raise exception 'Só quem cuida da manutenção pode alterar estes dados';
    end if;
    new.updated_at := now();
  end if;
  new.completed_at := case when new.status = 'concluida' then coalesce(case when tg_op = 'UPDATE' then old.completed_at end, now()) end;
  return new;
end $$;
create trigger maint_guard before insert or update on public.maintenance_requests
  for each row execute function public.maint_guard();

create or replace function public.maint_log()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into maintenance_updates (request_id, church_id, user_id, kind, body)
      values (new.id, new.church_id, new.requested_by, 'criada', 'Chamado aberto');
  else
    if new.status is distinct from old.status then
      insert into maintenance_updates (request_id, church_id, user_id, kind, body)
        values (new.id, new.church_id, auth.uid(), 'status', new.status::text);
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      insert into maintenance_updates (request_id, church_id, user_id, kind, body)
        values (new.id, new.church_id, auth.uid(), 'atribuicao', new.assigned_to::text);
    end if;
  end if;
  return null;
end $$;
create trigger maint_log after insert or update on public.maintenance_requests
  for each row execute function public.maint_log();

create or replace function public.maint_update_fill()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.church_id := (select church_id from maintenance_requests where id = new.request_id);
  return new;
end $$;
create trigger maint_update_fill before insert on public.maintenance_updates
  for each row execute function public.maint_update_fill();

revoke execute on function public.maint_guard, public.maint_log, public.maint_update_fill from public, anon, authenticated;

-- Políticas
create policy maint_read on public.maintenance_requests for select using (
  public.is_member(church_id) and (public.maint_can_manage(church_id) or requested_by = auth.uid() or assigned_to = auth.uid())
);
create policy maint_insert on public.maintenance_requests for insert with check (public.maint_can_request(church_id));
create policy maint_update on public.maintenance_requests for update
  using (public.is_member(church_id) and (public.maint_can_manage(church_id) or assigned_to = auth.uid()))
  with check (public.maint_can_manage(church_id) or assigned_to = auth.uid());
create policy maint_delete on public.maintenance_requests for delete using (public.maint_can_manage(church_id));

create policy maint_upd_read on public.maintenance_updates for select using (
  exists (select 1 from public.maintenance_requests r where r.id = request_id)  -- herda a visibilidade do chamado
);
create policy maint_upd_insert on public.maintenance_updates for insert with check (
  user_id = auth.uid() and kind = 'comentario'
  and exists (select 1 from public.maintenance_requests r where r.id = request_id)
);
create policy maint_upd_delete on public.maintenance_updates for delete using (
  kind = 'comentario' and (user_id = auth.uid() or public.maint_can_manage(church_id))
);

-- Nomes de quem participa da manutenção (quem pode abrir, cuidar ou é admin).
-- Membros comuns não leem `people`, então o quadro usa esta função.
create or replace function public.maintenance_people(p_church uuid)
returns table (user_id uuid, full_name text, can_manage boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id,
         coalesce(pe.full_name, pr.full_name, u.email),
         (m.role in ('owner','admin') or m.maint_manage)
  from memberships m
  join auth.users u on u.id = m.user_id
  left join people pe on pe.church_id = m.church_id and pe.user_id = m.user_id
  left join profiles pr on pr.id = m.user_id
  where m.church_id = p_church
    and (m.role in ('owner','admin') or m.maint_manage or m.maint_request)
    and public.maint_can_request(p_church)
  order by 2;
$$;
revoke execute on function public.maintenance_people from public, anon;
grant execute on function public.maintenance_people to authenticated;

-- Fotos: bucket PRIVADO <church_id>/<chamado>/<arquivo>, abertas por URL assinada.
insert into storage.buckets (id, name, public) values ('maintenance', 'maintenance', false) on conflict do nothing;
create policy maint_files_read on storage.objects for select to authenticated using (
  bucket_id = 'maintenance' and public.maint_can_request(((storage.foldername(name))[1])::uuid)
);
create policy maint_files_write on storage.objects for insert to authenticated with check (
  bucket_id = 'maintenance' and public.maint_can_request(((storage.foldername(name))[1])::uuid)
);
create policy maint_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'maintenance' and public.maint_can_manage(((storage.foldername(name))[1])::uuid)
);
