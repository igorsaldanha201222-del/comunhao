-- =====================================================================
-- Ministérios (cadastro genérico com "cara" por tipo) e Energia Solar
-- =====================================================================

-- ---------------------------------------------------------------------
-- Ministérios
-- kind define quais recursos aparecem: todos têm membros, funções e escalas;
-- 'louvor' ganha repertório e setlist por escala.
-- ---------------------------------------------------------------------
create type public.ministry_kind as enum
  ('louvor', 'diaconato', 'midia', 'recepcao', 'kids', 'intercessao', 'ensino', 'outro');
create type public.assignment_status as enum ('pendente', 'confirmado', 'recusado');

create table public.ministries (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  kind        public.ministry_kind not null default 'outro',
  name        text not null,
  description text,
  color       text not null default '#4f46e5' check (color ~ '^#[0-9a-fA-F]{6}$'),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index on public.ministries (church_id);

-- Funções dentro do ministério (ex.: Vocal, Bateria / Porta, Santa Ceia)
create table public.ministry_positions (
  id          uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  church_id   uuid not null references public.churches(id) on delete cascade,
  name        text not null,
  position    int not null default 0,
  unique (ministry_id, name)
);

create table public.ministry_members (
  ministry_id  uuid not null references public.ministries(id) on delete cascade,
  person_id    uuid not null references public.people(id) on delete cascade,
  church_id    uuid not null references public.churches(id) on delete cascade,
  is_leader    boolean not null default false,
  position_ids uuid[] not null default '{}',
  joined_at    timestamptz not null default now(),
  primary key (ministry_id, person_id)
);
create index on public.ministry_members (person_id);

create table public.schedules (
  id          uuid primary key default gen_random_uuid(),
  ministry_id uuid not null references public.ministries(id) on delete cascade,
  church_id   uuid not null references public.churches(id) on delete cascade,
  title       text not null,
  starts_at   timestamptz not null,
  notes       text,
  created_at  timestamptz not null default now()
);
create index on public.schedules (ministry_id, starts_at);

create table public.schedule_assignments (
  id          uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  church_id   uuid not null references public.churches(id) on delete cascade,
  person_id   uuid not null references public.people(id) on delete cascade,
  position_id uuid references public.ministry_positions(id) on delete set null,
  status      public.assignment_status not null default 'pendente',
  responded_at timestamptz,
  unique (schedule_id, person_id, position_id)
);
create index on public.schedule_assignments (person_id);

-- Repertório (louvor)
create table public.songs (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  ministry_id uuid references public.ministries(id) on delete set null,
  title       text not null,
  artist      text,
  song_key    text,
  bpm         int,
  link_url    text,          -- YouTube/Spotify de referência
  chord_url   text,          -- cifra/partitura enviada (PDF/imagem)
  audio_url   text,          -- guia/ensaio enviado
  lyrics      text,
  created_at  timestamptz not null default now()
);
create index on public.songs (church_id, title);

create table public.schedule_songs (
  schedule_id uuid not null references public.schedules(id) on delete cascade,
  song_id     uuid not null references public.songs(id) on delete cascade,
  church_id   uuid not null references public.churches(id) on delete cascade,
  position    int not null default 0,
  song_key    text,          -- tom usado nesta escala
  primary key (schedule_id, song_id)
);

-- Líder do ministério (sem ser equipe da igreja) também administra o ministério.
create or replace function public.leads_ministry(p_ministry uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ministry_members mm join people p on p.id = mm.person_id
    where mm.ministry_id = p_ministry and mm.is_leader and p.user_id = auth.uid()
  );
$$;

create or replace function public.can_manage_ministry(p_ministry uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.leads_ministry(p_ministry)
      or exists (select 1 from ministries m where m.id = p_ministry and public.is_staff(m.church_id));
$$;

create or replace function public.my_person_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from people where user_id = auth.uid();
$$;

alter table public.ministries           enable row level security;
alter table public.ministry_positions   enable row level security;
alter table public.ministry_members     enable row level security;
alter table public.schedules            enable row level security;
alter table public.schedule_assignments enable row level security;
alter table public.songs                enable row level security;
alter table public.schedule_songs       enable row level security;

-- Membros da igreja enxergam ministérios; equipe cria/edita; líder edita o seu.
create policy ministries_read  on public.ministries for select using (public.is_member(church_id));
create policy ministries_staff on public.ministries for all using (public.is_staff(church_id)) with check (public.is_staff(church_id));
create policy ministries_leader on public.ministries for update using (public.leads_ministry(id)) with check (public.leads_ministry(id));

create policy positions_read   on public.ministry_positions for select using (public.is_member(church_id));
create policy positions_manage on public.ministry_positions for all using (public.can_manage_ministry(ministry_id)) with check (public.can_manage_ministry(ministry_id));

create policy mm_read   on public.ministry_members for select using (public.is_member(church_id));
create policy mm_manage on public.ministry_members for all using (public.can_manage_ministry(ministry_id)) with check (public.can_manage_ministry(ministry_id));

create policy schedules_read   on public.schedules for select using (public.is_member(church_id));
create policy schedules_manage on public.schedules for all using (public.can_manage_ministry(ministry_id)) with check (public.can_manage_ministry(ministry_id));

create policy sa_read on public.schedule_assignments for select using (public.is_member(church_id));
create policy sa_manage on public.schedule_assignments for all using (
  public.can_manage_ministry((select s.ministry_id from public.schedules s where s.id = schedule_id))
) with check (
  public.can_manage_ministry((select s.ministry_id from public.schedules s where s.id = schedule_id))
);

create policy songs_read   on public.songs for select using (public.is_member(church_id));
create policy songs_manage on public.songs for all using (
  public.is_staff(church_id) or (ministry_id is not null and public.leads_ministry(ministry_id))
) with check (
  public.is_staff(church_id) or (ministry_id is not null and public.leads_ministry(ministry_id))
);

create policy ss_read   on public.schedule_songs for select using (public.is_member(church_id));
create policy ss_manage on public.schedule_songs for all using (
  public.can_manage_ministry((select s.ministry_id from public.schedules s where s.id = schedule_id))
) with check (
  public.can_manage_ministry((select s.ministry_id from public.schedules s where s.id = schedule_id))
);

-- Membro escalado confirma ou recusa pelo app (só o próprio status).
create or replace function public.respond_assignment(p_assignment uuid, p_accept boolean)
returns public.schedule_assignments language plpgsql security definer set search_path = public as $$
declare a schedule_assignments;
begin
  update schedule_assignments
     set status = (case when p_accept then 'confirmado' else 'recusado' end)::public.assignment_status, responded_at = now()
   where id = p_assignment and person_id in (select public.my_person_ids())
  returning * into a;
  if a.id is null then raise exception 'escala não encontrada'; end if;
  return a;
end $$;

-- Funções padrão por tipo de ministério, criadas junto com o ministério.
create or replace function public.seed_ministry_positions()
returns trigger language plpgsql security definer set search_path = public as $$
declare names text[];
begin
  names := case new.kind
    when 'louvor'      then array['Ministro','Vocal','Violão','Guitarra','Baixo','Teclado','Bateria','Som']
    when 'diaconato'   then array['Porta','Santa Ceia','Ofertório','Apoio ao culto']
    when 'midia'       then array['Projeção','Transmissão','Fotografia','Redes sociais','Câmera']
    when 'recepcao'    then array['Entrada','Boas-vindas','Estacionamento']
    when 'kids'        then array['Professor','Auxiliar','Check-in']
    when 'intercessao' then array['Intercessor','Coordenação']
    when 'ensino'      then array['Professor','Auxiliar']
    else array['Membro']
  end;
  insert into ministry_positions (ministry_id, church_id, name, position)
    select new.id, new.church_id, n, i - 1 from unnest(names) with ordinality as t(n, i);
  return new;
end $$;
create trigger ministries_seed_positions after insert on public.ministries
for each row execute function public.seed_ministry_positions();

-- ---------------------------------------------------------------------
-- Energia solar: dispositivo de leitura (ESP32/Arduino) por igreja,
-- leituras periódicas e alertas de falha.
-- ---------------------------------------------------------------------
create table public.solar_devices (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches(id) on delete cascade,
  name            text not null,
  inverter_brand  text,
  inverter_model  text,
  rated_power_kw  numeric(8,2),
  -- O aparelho se autentica com este token (gerado no cadastro). Só o hash fica salvo.
  token_hash      text not null unique,
  last_seen_at    timestamptz,
  last_power_w    numeric(12,1),
  last_status     text,
  created_at      timestamptz not null default now()
);

create table public.solar_readings (
  id            bigint generated always as identity primary key,
  device_id     uuid not null references public.solar_devices(id) on delete cascade,
  church_id     uuid not null references public.churches(id) on delete cascade,
  measured_at   timestamptz not null default now(),
  power_w       numeric(12,1),        -- potência ativa
  energy_today_kwh numeric(12,3),
  energy_total_kwh numeric(14,3),
  dc_voltage_v  numeric(8,1),
  ac_voltage_v  numeric(8,1),
  temperature_c numeric(6,1),
  status_code   int,                  -- código de estado do inversor
  fault_code    int,                  -- 0 = sem falha
  raw           jsonb
);
create index on public.solar_readings (device_id, measured_at desc);

create table public.solar_alerts (
  id          uuid primary key default gen_random_uuid(),
  device_id   uuid not null references public.solar_devices(id) on delete cascade,
  church_id   uuid not null references public.churches(id) on delete cascade,
  kind        text not null check (kind in ('falha','offline','sem_geracao')),
  message     text not null,
  opened_at   timestamptz not null default now(),
  resolved_at timestamptz
);
create index on public.solar_alerts (church_id, opened_at desc);
-- No máximo um alerta aberto por tipo e aparelho.
create unique index solar_alerts_one_open on public.solar_alerts (device_id, kind) where resolved_at is null;

alter table public.solar_devices  enable row level security;
alter table public.solar_readings enable row level security;
alter table public.solar_alerts   enable row level security;

-- Leitura pela equipe; gravação de leituras só pela Edge Function (service role).
create policy solar_devices_staff  on public.solar_devices  for select using (public.is_staff(church_id));
create policy solar_devices_admin  on public.solar_devices  for all using (public.is_admin(church_id)) with check (public.is_admin(church_id));
create policy solar_readings_staff on public.solar_readings for select using (public.is_staff(church_id));
create policy solar_alerts_staff   on public.solar_alerts   for select using (public.is_staff(church_id));
create policy solar_alerts_resolve on public.solar_alerts   for update using (public.is_staff(church_id)) with check (public.is_staff(church_id));

-- Cadastro do aparelho: devolve o token em texto UMA vez (vai gravado no firmware).
create or replace function public.create_solar_device(p_church uuid, p_name text, p_brand text, p_model text, p_kw numeric)
returns table (device_id uuid, device_token text) language plpgsql security definer set search_path = public as $$
declare tok text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); d uuid;
begin
  if not public.is_admin(p_church) then raise exception 'sem permissão'; end if;
  insert into solar_devices (church_id, name, inverter_brand, inverter_model, rated_power_kw, token_hash)
  values (p_church, p_name, p_brand, p_model, p_kw, encode(sha256(convert_to(tok, 'UTF8')), 'hex'))
  returning id into d;
  return query select d, tok;
end $$;

-- Marca aparelhos sem comunicação há mais de 15 min (rodar via pg_cron a cada 5 min).
create or replace function public.solar_check_offline()
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into solar_alerts (device_id, church_id, kind, message)
  select id, church_id, 'offline', 'Sem comunicação desde ' ||
         coalesce(to_char(last_seen_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), 'o cadastro')
    from solar_devices
   where last_seen_at is null or last_seen_at < now() - interval '15 minutes'
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Retenção: leituras brutas por 13 meses.
create or replace function public.solar_prune()
returns void language sql security definer set search_path = public as $$
  delete from solar_readings where measured_at < now() - interval '13 months';
$$;

revoke execute on function public.solar_check_offline, public.solar_prune from public, anon, authenticated;
revoke execute on function public.respond_assignment, public.create_solar_device from anon;

-- Equipe de uma escala para o app: só nome, função e status (sem expor contato/endereço de people).
create or replace function public.schedule_team(p_schedule uuid)
returns table (id uuid, full_name text, position_name text, status public.assignment_status)
language sql stable security definer set search_path = public as $$
  select sa.id, p.full_name, mp.name, sa.status
    from schedule_assignments sa
    join people p on p.id = sa.person_id
    left join ministry_positions mp on mp.id = sa.position_id
   where sa.schedule_id = p_schedule and public.is_member(sa.church_id)
   order by mp.position nulls last, p.full_name;
$$;
revoke execute on function public.schedule_team from anon;
