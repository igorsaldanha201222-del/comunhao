-- =====================================================================
-- Lista de presença do culto: liderança ou diaconato/recepção marca
-- quem veio, conta o público e cadastra visitantes na hora.
-- =====================================================================

-- Quem marca presença: liderança ou membro de ministério de diaconato/recepção.
create or replace function public.attendance_can_mark(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff(p_church) or exists (
    select 1 from ministry_members mm
    join ministries mi on mi.id = mm.ministry_id and mi.kind in ('diaconato', 'recepcao') and mi.active
    join people pe on pe.id = mm.person_id
    where mm.church_id = p_church and pe.user_id = auth.uid()
  );
$$;
grant execute on function public.attendance_can_mark to authenticated;

create table public.services (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references public.churches(id) on delete cascade,
  service_date date not null,
  title        text not null default 'Culto' check (length(title) between 2 and 80),
  headcount    int check (headcount >= 0),       -- contagem total do público (opcional)
  notes        text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (church_id, service_date, title)
);
create index on public.services (church_id, service_date desc);

create table public.service_attendance (
  service_id uuid not null references public.services(id) on delete cascade,
  person_id  uuid not null references public.people(id) on delete cascade,
  church_id  uuid not null references public.churches(id) on delete cascade,
  marked_by  uuid references auth.users(id) on delete set null default auth.uid(),
  marked_at  timestamptz not null default now(),
  primary key (service_id, person_id)
);
create index on public.service_attendance (church_id, person_id);

alter table public.services           enable row level security;
alter table public.service_attendance enable row level security;

create policy services_read   on public.services for select using (public.is_member(church_id));
create policy services_manage on public.services for all
  using (public.attendance_can_mark(church_id)) with check (public.attendance_can_mark(church_id));
create policy svc_att_read on public.service_attendance for select using (
  public.attendance_can_mark(church_id)
  or exists (select 1 from people p where p.id = person_id and p.user_id = auth.uid()));
create policy svc_att_manage on public.service_attendance for all
  using (public.attendance_can_mark(church_id)) with check (public.attendance_can_mark(church_id));

-- O diaconato não lê o cadastro completo de pessoas: só nome e situação, para a chamada.
create or replace function public.attendance_people(p_church uuid)
returns table (id uuid, full_name text, status public.person_status) language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.status from people p
  where p.church_id = p_church and p.status <> 'inativo' and public.attendance_can_mark(p_church)
  order by p.full_name;
$$;
revoke execute on function public.attendance_people from public, anon;
grant execute on function public.attendance_people to authenticated;

-- Visitante novo no culto: cadastra e já marca presença.
create or replace function public.attendance_add_visitor(p_service uuid, p_name text, p_phone text default null)
returns public.people language plpgsql security definer set search_path = public as $$
declare s services; p people;
begin
  select * into s from services where id = p_service;
  if s.id is null or not public.attendance_can_mark(s.church_id) then raise exception 'Sem permissão'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 then raise exception 'Informe o nome do visitante'; end if;
  insert into people (church_id, full_name, phone, status, notes)
    values (s.church_id, trim(p_name), nullif(trim(p_phone), ''), 'visitante', 'Primeira visita: ' || to_char(s.service_date, 'DD/MM/YYYY') || ' (' || s.title || ')')
    returning * into p;
  insert into service_attendance (service_id, person_id, church_id) values (s.id, p.id, s.church_id);
  return p;
end $$;
revoke execute on function public.attendance_add_visitor from public, anon;
grant execute on function public.attendance_add_visitor to authenticated;
