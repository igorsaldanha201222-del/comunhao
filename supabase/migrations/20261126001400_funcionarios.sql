-- Funcionários da igreja: cadastro com salário e escala, folha lançada sozinha no financeiro
-- (contas a pagar) e ponto pelo celular conferido pelo GPS.
-- Quem administra: pastor/administração e tesouraria (is_finance). O funcionário vê só o dele.

create table public.employees (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches(id) on delete cascade,
  person_id       uuid references public.people(id) on delete set null,
  user_id         uuid references auth.users(id) on delete set null,   -- conta no app (para bater ponto)
  full_name       text not null check (length(full_name) between 2 and 120),
  job_title       text not null check (length(job_title) between 2 and 60),       -- ex.: Secretária, Zelador
  salary_cents    bigint not null default 0 check (salary_cents >= 0),
  pay_day         smallint not null default 5 check (pay_day between 1 and 31),
  pix_key         text check (length(pix_key) <= 140),
  admission_date  date,
  work_days       smallint[] not null default '{1,2,3,4,5}',   -- 0 = domingo … 6 = sábado
  start_time      time,
  end_time        time,
  punch_required  boolean not null default true,               -- bate ponto pelo app
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  unique (church_id, user_id)
);
create index on public.employees (church_id, active);

-- Ligação do salário com o lançamento (um por funcionário por mês).
alter table public.finance_entries
  add column if not exists employee_id uuid references public.employees(id) on delete set null,
  add column if not exists competence  date;   -- 1º dia do mês a que o pagamento se refere
create unique index if not exists finance_entries_payroll_uniq
  on public.finance_entries (employee_id, competence) where employee_id is not null;

create table public.time_punches (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references public.churches(id) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  kind         text not null check (kind in ('entrada', 'saida')),
  at           timestamptz not null default now(),
  source       text not null default 'gps' check (source in ('gps', 'manual')),
  distance_m   int,
  note         text check (length(note) <= 200),
  created_by   uuid references auth.users(id) on delete set null
);
create index on public.time_punches (employee_id, at desc);
create index on public.time_punches (church_id, at desc);

alter table public.employees    enable row level security;
alter table public.time_punches enable row level security;

create policy employees_manage on public.employees for all
  using (public.is_finance(church_id)) with check (public.is_finance(church_id));
create policy employees_self on public.employees for select using (user_id = auth.uid());

create policy punches_read on public.time_punches for select using (
  public.is_finance(church_id) or public.is_staff(church_id)
  or exists (select 1 from employees e where e.id = employee_id and e.user_id = auth.uid()));
-- correção manual (esqueceu de bater): só quem administra
create policy punches_manage on public.time_punches for all
  using (public.is_finance(church_id)) with check (public.is_finance(church_id));

-- Liderança vê quem está trabalhando (nome, cargo e escala), sem salário.
create or replace function public.staff_on_duty(p_church uuid)
returns table (employee_id uuid, full_name text, job_title text, start_time time, end_time time,
               works_today boolean, last_kind text, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.id, e.full_name, e.job_title, e.start_time, e.end_time,
         extract(dow from (now() at time zone 'America/Sao_Paulo'))::smallint = any(e.work_days),
         p.kind, p.at
  from employees e
  left join lateral (
    select kind, at from time_punches t
    where t.employee_id = e.id and (t.at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
    order by at desc limit 1) p on true
  where e.church_id = p_church and e.active and (public.is_staff(p_church) or public.is_finance(p_church))
  order by e.full_name;
$$;
revoke execute on function public.staff_on_duty from public, anon;
grant execute on function public.staff_on_duty to authenticated;

-- Bater ponto: alterna entrada/saída e confere a distância até a igreja.
create or replace function public.clock_punch(p_church uuid, p_lat double precision, p_lng double precision, p_accuracy double precision default null)
returns public.time_punches language plpgsql security definer set search_path = public as $$
declare e employees; c churches; d double precision; allowed double precision; last text; r time_punches;
begin
  select * into e from employees where church_id = p_church and user_id = auth.uid() and active;
  if e.id is null then raise exception 'Você não está cadastrado como funcionário'; end if;
  select * into c from churches where id = p_church;
  if c.lat is null then raise exception 'A igreja ainda não marcou o local dela no painel'; end if;
  d := 6371000 * 2 * asin(sqrt(
        power(sin(radians(p_lat - c.lat) / 2), 2)
      + cos(radians(c.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - c.lng) / 2), 2)));
  allowed := c.checkin_radius + least(greatest(coalesce(p_accuracy, 0), 0), 100);
  if d > allowed then
    raise exception 'Você parece estar a % m da igreja. Bata o ponto quando estiver lá.', round(d)::int;
  end if;
  select kind into last from time_punches
  where employee_id = e.id and (at at time zone 'America/Sao_Paulo')::date = (now() at time zone 'America/Sao_Paulo')::date
  order by at desc limit 1;
  -- evita batida dupla sem querer (2 minutos)
  if exists (select 1 from time_punches where employee_id = e.id and at > now() - interval '2 minutes') then
    raise exception 'Ponto já registrado agora há pouco';
  end if;
  insert into time_punches (church_id, employee_id, kind, source, distance_m, created_by)
  values (p_church, e.id, case when last = 'entrada' then 'saida' else 'entrada' end, 'gps', round(d)::int, auth.uid())
  returning * into r;
  return r;
end $$;
revoke execute on function public.clock_punch from public, anon;
grant execute on function public.clock_punch to authenticated;

-- Folha do mês: cria a conta a pagar do salário de cada funcionário ativo (uma vez por mês).
-- Pode ser chamada quantas vezes quiser: não duplica.
create or replace function public.payroll_generate(p_church uuid, p_month date default null)
returns int language plpgsql security definer set search_path = public as $$
declare m date := date_trunc('month', coalesce(p_month, (now() at time zone 'America/Sao_Paulo')::date))::date;
        last_day int; cat uuid; n int;
begin
  if not public.is_finance(p_church) then raise exception 'Sem permissão'; end if;
  last_day := extract(day from (m + interval '1 month - 1 day'))::int;
  select id into cat from finance_categories where church_id = p_church and type = 'saida' and name = 'Prebenda/Salários';
  insert into finance_entries (church_id, type, status, entry_date, due_date, amount_cents, description,
                               category_id, counterparty, employee_id, competence, created_by, updated_by)
  select p_church, 'saida', 'pendente',
         make_date(extract(year from m)::int, extract(month from m)::int, least(e.pay_day, last_day)),
         make_date(extract(year from m)::int, extract(month from m)::int, least(e.pay_day, last_day)),
         e.salary_cents, 'Salário ' || to_char(m, 'MM/YYYY') || ' · ' || e.full_name,
         cat, e.full_name, e.id, m, auth.uid(), auth.uid()
  from employees e
  where e.church_id = p_church and e.active and e.salary_cents > 0
    and (e.admission_date is null or e.admission_date <= (m + interval '1 month - 1 day')::date)
  on conflict (employee_id, competence) where employee_id is not null do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.payroll_generate from public, anon;
grant execute on function public.payroll_generate to authenticated;

-- O funcionário é escolhido entre as pessoas da igreja; a conta do app vem do cadastro dela.
create or replace function public.employees_sync_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.person_id is not null then
    select user_id into new.user_id from people where id = new.person_id and church_id = new.church_id;
  else
    new.user_id := null;
  end if;
  return new;
end $$;
create trigger employees_sync_user before insert or update of person_id on public.employees
for each row execute function public.employees_sync_user();

-- Lista de pessoas para escolher no cadastro de funcionário (tesouraria não vê o cadastro completo).
create or replace function public.employee_people(p_church uuid)
returns table (id uuid, full_name text, has_app boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.user_id is not null from people p
  where p.church_id = p_church and p.status <> 'inativo' and public.is_finance(p_church)
  order by p.full_name;
$$;
revoke execute on function public.employee_people from public, anon;
grant execute on function public.employee_people to authenticated;
