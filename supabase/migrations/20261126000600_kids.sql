-- =====================================================================
-- Ministério Kids: crianças, responsáveis, turmas e check-in seguro.
--  * Pais (pelo app) cadastram os filhos e fazem pré-check-in.
--  * Voluntários do ministério Kids (e a equipe) fazem check-in/retirada
--    no painel; a retirada exige o código de segurança da etiqueta.
-- =====================================================================

-- Quem trabalha no Kids: equipe da igreja ou membro de um ministério do tipo 'kids'.
create or replace function public.kids_can_manage(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff(p_church) or exists (
    select 1 from ministry_members mm
    join ministries mi on mi.id = mm.ministry_id and mi.kind = 'kids' and mi.active
    join people pe on pe.id = mm.person_id
    where mm.church_id = p_church and pe.user_id = auth.uid()
  );
$$;

create table public.kids_rooms (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null references public.churches(id) on delete cascade,
  name       text not null check (length(name) between 2 and 60),
  min_age    int  not null default 0 check (min_age between 0 and 17),
  max_age    int  not null default 12 check (max_age between 0 and 17),
  color      text not null default '#f59e0b' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position   int  not null default 0,
  active     boolean not null default true
);
create index on public.kids_rooms (church_id, position);

create table public.kids_children (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches(id) on delete cascade,
  full_name     text not null check (length(full_name) between 2 and 120),
  birth_date    date,
  allergies     text check (length(allergies) <= 500),
  medical_notes text check (length(medical_notes) <= 1000),
  notes         text check (length(notes) <= 1000),
  photo_url     text,
  created_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now()
);
create index on public.kids_children (church_id, full_name);

-- Responsáveis: usuário do app (user_id) ou só nome/telefone (avó, tio…).
create table public.kids_guardians (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references public.kids_children(id) on delete cascade,
  church_id    uuid not null references public.churches(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade,
  name         text not null check (length(name) between 2 and 120),
  phone        text check (length(phone) <= 30),
  relationship text check (length(relationship) <= 40),
  can_pickup   boolean not null default true,
  unique (child_id, user_id)
);
create index on public.kids_guardians (user_id);

create type public.kids_checkin_status as enum ('pre', 'presente', 'retirado', 'cancelado');

create table public.kids_checkins (
  id             uuid primary key default gen_random_uuid(),
  church_id      uuid not null references public.churches(id) on delete cascade,
  child_id       uuid not null references public.kids_children(id) on delete cascade,
  room_id        uuid references public.kids_rooms(id) on delete set null,
  status         public.kids_checkin_status not null default 'presente',
  security_code  text not null,
  service_date   date not null default (now() at time zone 'America/Sao_Paulo')::date,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id) on delete set null,
  checked_in_at  timestamptz,
  checked_in_by  uuid references auth.users(id) on delete set null,
  checked_out_at timestamptz,
  checked_out_by uuid references auth.users(id) on delete set null,
  picked_up_by   text check (length(picked_up_by) <= 120)
);
create index on public.kids_checkins (church_id, service_date, status);
create index on public.kids_checkins (child_id, created_at desc);
-- Uma criança só pode estar "aberta" (pré ou presente) uma vez por dia.
create unique index kids_one_open_checkin on public.kids_checkins (child_id, service_date)
  where status in ('pre', 'presente');

alter table public.kids_rooms     enable row level security;
alter table public.kids_children  enable row level security;
alter table public.kids_guardians enable row level security;
alter table public.kids_checkins  enable row level security;

create or replace function public.kids_is_guardian(p_child uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from kids_guardians where child_id = p_child and user_id = auth.uid());
$$;

-- Turmas: qualquer membro vê (o app mostra a sala); equipe Kids gerencia.
create policy kids_rooms_read   on public.kids_rooms for select using (public.is_member(church_id));
create policy kids_rooms_manage on public.kids_rooms for all
  using (public.kids_can_manage(church_id)) with check (public.kids_can_manage(church_id));

-- Crianças: equipe Kids vê todas; pais veem os próprios filhos.
create policy kids_children_read on public.kids_children for select
  using (public.kids_can_manage(church_id) or public.kids_is_guardian(id));
create policy kids_children_manage on public.kids_children for all
  using (public.kids_can_manage(church_id)) with check (public.kids_can_manage(church_id));
create policy kids_children_parent_update on public.kids_children for update
  using (public.kids_is_guardian(id)) with check (public.kids_is_guardian(id));

create policy kids_guardians_read on public.kids_guardians for select
  using (public.kids_can_manage(church_id) or user_id = auth.uid() or public.kids_is_guardian(child_id));
create policy kids_guardians_manage on public.kids_guardians for all
  using (public.kids_can_manage(church_id)) with check (public.kids_can_manage(church_id));
-- Pais adicionam outros responsáveis sem conta (avó, tio), nunca outro usuário.
create policy kids_guardians_parent_add on public.kids_guardians for insert
  with check (public.kids_is_guardian(child_id) and user_id is null);
create policy kids_guardians_parent_del on public.kids_guardians for delete
  using (public.kids_is_guardian(child_id) and user_id is null);

create policy kids_checkins_read on public.kids_checkins for select
  using (public.kids_can_manage(church_id) or public.kids_is_guardian(child_id));
-- Mudanças de check-in só pelas funções abaixo (geram código e validam retirada).

-- Código de 4 caracteres sem letras ambíguas (0/O, 1/I).
create or replace function public.kids_new_code(p_church uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare c text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  loop
    c := '';
    for i in 1..4 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from kids_checkins where church_id = p_church and security_code = c
                          and service_date = (now() at time zone 'America/Sao_Paulo')::date and status in ('pre','presente'));
  end loop;
  return c;
end $$;

-- Turma sugerida pela idade.
create or replace function public.kids_room_for(p_child uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select r.id from kids_children k
  join kids_rooms r on r.church_id = k.church_id and r.active
  where k.id = p_child
    and (k.birth_date is null or extract(year from age(k.birth_date))::int between r.min_age and r.max_age)
  order by r.position limit 1;
$$;

-- Pais cadastram um filho pelo app (cria a criança + o vínculo de responsável).
create or replace function public.kids_register_child(
  p_church uuid, p_name text, p_birth date, p_allergies text default null, p_notes text default null,
  p_relationship text default 'Responsável')
returns public.kids_children language plpgsql security definer set search_path = public as $$
declare k kids_children; me text;
begin
  if not public.is_member(p_church) then raise exception 'Você não faz parte desta igreja'; end if;
  insert into kids_children (church_id, full_name, birth_date, allergies, notes, created_by)
    values (p_church, trim(p_name), p_birth, nullif(trim(p_allergies), ''), nullif(trim(p_notes), ''), auth.uid())
    returning * into k;
  select coalesce(p.full_name, u.email), p.phone into me from auth.users u left join profiles p on p.id = u.id where u.id = auth.uid();
  insert into kids_guardians (child_id, church_id, user_id, name, relationship)
    values (k.id, p_church, auth.uid(), coalesce(me, 'Responsável'), p_relationship);
  return k;
end $$;

-- Pré-check-in pelos pais (no dia): gera o código que eles mostram na porta da sala.
create or replace function public.kids_precheckin(p_child uuid)
returns public.kids_checkins language plpgsql security definer set search_path = public as $$
declare k kids_children; r kids_checkins;
begin
  select * into k from kids_children where id = p_child;
  if k.id is null or not (public.kids_is_guardian(p_child) or public.kids_can_manage(k.church_id)) then
    raise exception 'Sem permissão para esta criança';
  end if;
  select * into r from kids_checkins where child_id = p_child
    and service_date = (now() at time zone 'America/Sao_Paulo')::date and status in ('pre','presente');
  if r.id is not null then return r; end if;
  insert into kids_checkins (church_id, child_id, room_id, status, security_code, created_by)
    values (k.church_id, p_child, public.kids_room_for(p_child), 'pre', public.kids_new_code(k.church_id), auth.uid())
    returning * into r;
  return r;
end $$;

-- Check-in na porta da sala (voluntário). Confirma o pré-check-in ou cria um novo.
create or replace function public.kids_checkin(p_child uuid, p_room uuid default null)
returns public.kids_checkins language plpgsql security definer set search_path = public as $$
declare k kids_children; r kids_checkins;
begin
  select * into k from kids_children where id = p_child;
  if k.id is null or not public.kids_can_manage(k.church_id) then raise exception 'Sem permissão'; end if;
  select * into r from kids_checkins where child_id = p_child
    and service_date = (now() at time zone 'America/Sao_Paulo')::date and status in ('pre','presente');
  if r.id is null then
    insert into kids_checkins (church_id, child_id, room_id, status, security_code, created_by, checked_in_at, checked_in_by)
      values (k.church_id, p_child, coalesce(p_room, public.kids_room_for(p_child)), 'presente',
              public.kids_new_code(k.church_id), auth.uid(), now(), auth.uid())
      returning * into r;
  else
    update kids_checkins set status = 'presente', room_id = coalesce(p_room, room_id, public.kids_room_for(p_child)),
      checked_in_at = coalesce(checked_in_at, now()), checked_in_by = coalesce(checked_in_by, auth.uid())
      where id = r.id returning * into r;
  end if;
  return r;
end $$;

-- Retirada: só com o código de segurança da etiqueta do responsável.
create or replace function public.kids_checkout(p_checkin uuid, p_code text, p_picked_up_by text default null)
returns public.kids_checkins language plpgsql security definer set search_path = public as $$
declare r kids_checkins;
begin
  select * into r from kids_checkins where id = p_checkin;
  if r.id is null or not public.kids_can_manage(r.church_id) then raise exception 'Sem permissão'; end if;
  if r.status <> 'presente' then raise exception 'Esta criança não está na sala'; end if;
  if upper(trim(p_code)) <> r.security_code then raise exception 'Código de segurança não confere'; end if;
  update kids_checkins set status = 'retirado', checked_out_at = now(), checked_out_by = auth.uid(),
    picked_up_by = nullif(trim(p_picked_up_by), '')
    where id = r.id returning * into r;
  return r;
end $$;

create or replace function public.kids_cancel(p_checkin uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r kids_checkins;
begin
  select * into r from kids_checkins where id = p_checkin;
  if r.id is null or not (public.kids_can_manage(r.church_id) or (r.status = 'pre' and public.kids_is_guardian(r.child_id))) then
    raise exception 'Sem permissão';
  end if;
  update kids_checkins set status = 'cancelado' where id = r.id and status in ('pre','presente');
end $$;

revoke execute on function public.kids_new_code from public, anon, authenticated;
revoke execute on function public.kids_register_child, public.kids_precheckin, public.kids_checkin,
  public.kids_checkout, public.kids_cancel from public, anon;
grant execute on function public.kids_register_child, public.kids_precheckin, public.kids_checkin,
  public.kids_checkout, public.kids_cancel to authenticated;

-- Turmas padrão (igrejas atuais e novas).
create or replace function public.seed_kids_rooms(p_church uuid)
returns void language sql security definer set search_path = public as $$
  insert into kids_rooms (church_id, name, min_age, max_age, color, position)
  select p_church, n, a, b, c, p from (values
    ('Berçário', 0, 2, '#f472b6', 1), ('Maternal', 3, 5, '#f59e0b', 2),
    ('Kids', 6, 8, '#10b981', 3), ('Juniores', 9, 11, '#3b82f6', 4)) v(n, a, b, c, p)
  where not exists (select 1 from kids_rooms where church_id = p_church);
$$;
revoke execute on function public.seed_kids_rooms from public, anon, authenticated;
select public.seed_kids_rooms(id) from public.churches;
create or replace function public.seed_kids_rooms_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.seed_kids_rooms(new.id); return new; end $$;
create trigger seed_kids_rooms after insert on public.churches for each row execute function public.seed_kids_rooms_trigger();

-- Voluntários do Kids precisam ler os nomes dos responsáveis/crianças, não o cadastro geral de pessoas.

-- Aulas: programação da aula, versículo, atividade para casa e anexos (PDF/fotos).
-- Professores (equipe Kids) publicam; os pais veem no app o que o filho aprendeu.
create table public.kids_lessons (
  id            uuid primary key default gen_random_uuid(),
  church_id     uuid not null references public.churches(id) on delete cascade,
  room_id       uuid references public.kids_rooms(id) on delete set null,   -- null = todas as turmas
  lesson_date   date not null default (now() at time zone 'America/Sao_Paulo')::date,
  title         text not null check (length(title) between 3 and 140),
  bible_verse   text check (length(bible_verse) <= 300),
  plan          text check (length(plan) <= 8000),        -- programação / roteiro da aula
  home_activity text check (length(home_activity) <= 4000), -- atividade para fazer em casa
  materials     text check (length(materials) <= 2000),
  attachments   jsonb not null default '[]',               -- [{name, url}]
  published     boolean not null default true,
  created_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.kids_lessons (church_id, lesson_date desc);
alter table public.kids_lessons enable row level security;
create policy kids_lessons_read on public.kids_lessons for select
  using (public.kids_can_manage(church_id) or (published and public.is_member(church_id)));
create policy kids_lessons_manage on public.kids_lessons for all
  using (public.kids_can_manage(church_id)) with check (public.kids_can_manage(church_id));

-- Anexos das aulas vão no bucket público `media` (<igreja>/kids/...): voluntários do Kids podem subir.
create policy media_kids_write on storage.objects for insert to authenticated with check (
  bucket_id = 'media' and (storage.foldername(name))[2] = 'kids'
  and public.kids_can_manage(((storage.foldername(name))[1])::uuid)
);
