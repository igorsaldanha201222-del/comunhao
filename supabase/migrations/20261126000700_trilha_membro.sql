-- =====================================================================
-- Trilha "Quero ser membro": visitante → conversa com o pastor →
-- NCC (Núcleo de Crescimento Cristão) → apresentação à igreja → membro.
-- O visitante só abre a trilha; quem avança as etapas é a liderança.
-- =====================================================================

create type public.journey_step as enum ('conversa', 'ncc', 'apresentacao', 'concluido');

-- Encontros do NCC (cada igreja edita os seus)
create table public.ncc_lessons (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  position    int not null default 0,
  title       text not null check (length(title) between 2 and 120),
  description text,
  created_at  timestamptz not null default now()
);
create index on public.ncc_lessons (church_id, position);

create table public.member_journeys (
  id                uuid primary key default gen_random_uuid(),
  church_id         uuid not null references public.churches(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  full_name         text not null,
  phone             text,
  motivation        text,
  step              public.journey_step not null default 'conversa',
  talk_at           timestamptz,           -- conversa agendada
  talk_with         text,                  -- com quem (pastor/pastora)
  talk_done_at      timestamptz,
  ncc_class         text,                  -- turma / dia e horário do NCC
  ncc_done_at       timestamptz,
  presentation_date date,                  -- culto em que será apresentado
  presented_at      timestamptz,
  gave_up           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (church_id, user_id)
);
create index on public.member_journeys (church_id, step);

create table public.ncc_attendance (
  journey_id uuid not null references public.member_journeys(id) on delete cascade,
  lesson_id  uuid not null references public.ncc_lessons(id) on delete cascade,
  church_id  uuid not null references public.churches(id) on delete cascade,
  done_at    timestamptz not null default now(),
  primary key (journey_id, lesson_id)
);

alter table public.ncc_lessons     enable row level security;
alter table public.member_journeys enable row level security;
alter table public.ncc_attendance  enable row level security;

create policy ncc_lessons_read   on public.ncc_lessons for select using (public.is_member(church_id));
create policy ncc_lessons_manage on public.ncc_lessons for all
  using (public.is_staff(church_id)) with check (public.is_staff(church_id));

create policy journeys_read on public.member_journeys for select
  using (user_id = auth.uid() or public.is_staff(church_id));
-- criação só pela função journey_start; avanço só pela liderança
create policy journeys_manage on public.member_journeys for update
  using (public.is_staff(church_id)) with check (public.is_staff(church_id));
create policy journeys_delete on public.member_journeys for delete using (public.is_staff(church_id));

create policy ncc_att_read on public.ncc_attendance for select using (
  public.is_staff(church_id)
  or exists (select 1 from member_journeys j where j.id = journey_id and j.user_id = auth.uid()));
create policy ncc_att_manage on public.ncc_attendance for all
  using (public.is_staff(church_id)) with check (public.is_staff(church_id));

-- Etapa sempre derivada dos marcos (ninguém "pula" etapa por engano)
create or replace function public.journey_derive()
returns trigger language plpgsql set search_path = public as $$
begin
  new.step := case
    when new.presented_at is not null then 'concluido'
    when new.ncc_done_at  is not null then 'apresentacao'
    when new.talk_done_at is not null then 'ncc'
    else 'conversa' end::journey_step;
  new.updated_at := now();
  return new;
end $$;
create trigger journey_derive before insert or update on public.member_journeys
  for each row execute function public.journey_derive();

-- Concluiu a trilha: a pessoa vira membro no cadastro
create or replace function public.journey_finish()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.step = 'concluido' and old.step is distinct from 'concluido' then
    update people set status = 'membro' where church_id = new.church_id and user_id = new.user_id;
  end if;
  return new;
end $$;
create trigger journey_finish after update on public.member_journeys
  for each row execute function public.journey_finish();

-- Presença no NCC: completou todos os encontros → NCC concluído
create or replace function public.ncc_sync()
returns trigger language plpgsql security definer set search_path = public as $$
declare j uuid := coalesce(new.journey_id, old.journey_id); c uuid := coalesce(new.church_id, old.church_id);
  total int; done int;
begin
  select count(*) into total from ncc_lessons where church_id = c;
  select count(*) into done from ncc_attendance where journey_id = j;
  update member_journeys set ncc_done_at = case
      when total > 0 and done >= total then coalesce(ncc_done_at, now()) else null end
    where id = j and talk_done_at is not null;
  return null;
end $$;
create trigger ncc_sync after insert or delete on public.ncc_attendance
  for each row execute function public.ncc_sync();

-- O visitante abre a trilha (entra na igreja se ainda não for da igreja)
create or replace function public.journey_start(p_church uuid, p_phone text default null, p_motivation text default null)
returns public.member_journeys language plpgsql security definer set search_path = public as $$
declare j member_journeys; nm text;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if not exists (select 1 from churches where id = p_church and active) then raise exception 'igreja não encontrada'; end if;
  insert into memberships (church_id, user_id, role) values (p_church, auth.uid(), 'member') on conflict do nothing;
  insert into people (church_id, user_id, full_name, email, phone, status)
    select p_church, u.id, coalesce(p.full_name, u.email), u.email, coalesce(nullif(trim(p_phone), ''), p.phone), 'visitante'
    from auth.users u left join profiles p on p.id = u.id where u.id = auth.uid()
  on conflict (church_id, user_id) do nothing;
  if exists (select 1 from people where church_id = p_church and user_id = auth.uid() and status = 'membro') then
    raise exception 'você já é membro desta igreja';
  end if;
  select coalesce(p.full_name, u.email) into nm from auth.users u left join profiles p on p.id = u.id where u.id = auth.uid();
  insert into member_journeys (church_id, user_id, full_name, phone, motivation)
    values (p_church, auth.uid(), nm, nullif(trim(p_phone), ''), nullif(trim(p_motivation), ''))
  on conflict (church_id, user_id) do update set gave_up = false
  returning * into j;
  return j;
end $$;
revoke execute on function public.journey_start from public, anon;
grant execute on function public.journey_start to authenticated;
revoke execute on function public.journey_derive, public.journey_finish, public.ncc_sync from public, anon, authenticated;

-- Encontros padrão do NCC (igrejas atuais e novas)
create or replace function public.seed_ncc_lessons(p_church uuid)
returns void language sql security definer set search_path = public as $$
  insert into ncc_lessons (church_id, position, title, description)
  select p_church, p, t, d from (values
    (1, 'Salvação e nova vida', 'O que Jesus fez por nós e o que muda quando cremos.'),
    (2, 'Batismo e Santa Ceia', 'O significado das ordenanças e como participar.'),
    (3, 'Palavra e oração', 'Como ler a Bíblia e cultivar uma vida de oração.'),
    (4, 'Vida em comunidade', 'Igreja, células e cuidado uns com os outros.'),
    (5, 'Dízimos, ofertas e serviço', 'Mordomia e como servir nos ministérios.'),
    (6, 'Nossa igreja: visão e valores', 'História, visão, liderança e o compromisso de membro.')) v(p, t, d)
  where not exists (select 1 from ncc_lessons where church_id = p_church);
$$;
revoke execute on function public.seed_ncc_lessons from public, anon, authenticated;
select public.seed_ncc_lessons(id) from public.churches;
create or replace function public.seed_ncc_lessons_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.seed_ncc_lessons(new.id); return new; end $$;
create trigger seed_ncc_lessons after insert on public.churches for each row execute function public.seed_ncc_lessons_trigger();
