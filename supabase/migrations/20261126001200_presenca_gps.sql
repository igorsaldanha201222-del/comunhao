-- =====================================================================
-- Presença confirmada pelo celular: GPS (ao responder "Sim" na notificação)
-- ou QR Code na entrada. Guarda só o resultado e a distância, nunca a posição.
-- =====================================================================

alter table public.churches
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180),
  add column checkin_radius int not null default 150 check (checkin_radius between 50 and 1000);

alter table public.services add column confirm_sent_at timestamptz;

alter table public.service_attendance
  add column source text not null default 'manual' check (source in ('manual', 'gps', 'qr')),
  add column distance_m int;

-- Código do QR de cada culto: fica numa tabela à parte para membro não conseguir ler
-- (quem tem o código confirma presença sem estar lá).
create table public.service_checkin_tokens (
  service_id uuid primary key references public.services(id) on delete cascade,
  church_id  uuid not null references public.churches(id) on delete cascade,
  token      text not null unique default replace(gen_random_uuid()::text, '-', '')
);
alter table public.service_checkin_tokens enable row level security;
create policy checkin_tokens_markers on public.service_checkin_tokens for select using (public.attendance_can_mark(church_id));

create or replace function public.set_church_location(p_church uuid, p_lat double precision, p_lng double precision, p_radius int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(p_church) then raise exception 'Sem permissão'; end if;
  update churches set lat = p_lat, lng = p_lng, checkin_radius = coalesce(p_radius, 150) where id = p_church;
end $$;
revoke execute on function public.set_church_location from public, anon;
grant execute on function public.set_church_location to authenticated;

create or replace function public.service_qr_token(p_service uuid)
returns text language plpgsql security definer set search_path = public as $$
declare s services; t text;
begin
  select * into s from services where id = p_service;
  if s.id is null or not public.attendance_can_mark(s.church_id) then raise exception 'Sem permissão'; end if;
  insert into service_checkin_tokens (service_id, church_id) values (s.id, s.church_id) on conflict (service_id) do nothing;
  select token into t from service_checkin_tokens where service_id = s.id;
  return t;
end $$;
revoke execute on function public.service_qr_token from public, anon;
grant execute on function public.service_qr_token to authenticated;

-- Pessoa (cadastro) do usuário logado nesta igreja, validando o dia do culto.
create or replace function public._checkin_person(s services)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare pid uuid;
begin
  if s.id is null or not public.is_member(s.church_id) then raise exception 'Culto não encontrado'; end if;
  if s.service_date <> (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'A confirmação vale só no dia do culto';
  end if;
  select id into pid from people where church_id = s.church_id and user_id = auth.uid() limit 1;
  if pid is null then raise exception 'Seu cadastro na igreja não foi encontrado'; end if;
  return pid;
end $$;
revoke execute on function public._checkin_person from public, anon, authenticated;

-- "Sim, estou no culto": confere a distância até a igreja e marca presença.
create or replace function public.self_checkin(p_service uuid, p_lat double precision, p_lng double precision, p_accuracy double precision default null)
returns int language plpgsql security definer set search_path = public as $$
declare s services; c churches; pid uuid; d double precision; allowed double precision;
begin
  select * into s from services where id = p_service;
  pid := public._checkin_person(s);
  select * into c from churches where id = s.church_id;
  if c.lat is null then raise exception 'A igreja ainda não marcou o local dela no painel'; end if;
  d := 6371000 * 2 * asin(sqrt(
        power(sin(radians(p_lat - c.lat) / 2), 2)
      + cos(radians(c.lat)) * cos(radians(p_lat)) * power(sin(radians(p_lng - c.lng) / 2), 2)));
  -- tolera a imprecisão do GPS dentro do prédio (até 100 m a mais)
  allowed := c.checkin_radius + least(greatest(coalesce(p_accuracy, 0), 0), 100);
  if d > allowed then
    raise exception 'Você parece estar a % m da igreja. Confirme quando estiver lá.', round(d)::int;
  end if;
  insert into service_attendance (service_id, person_id, church_id, marked_by, source, distance_m)
    values (s.id, pid, s.church_id, auth.uid(), 'gps', round(d)::int)
    on conflict (service_id, person_id) do nothing;
  return round(d)::int;
end $$;
revoke execute on function public.self_checkin from public, anon;
grant execute on function public.self_checkin to authenticated;

-- QR Code da entrada: devolve o nome do culto.
create or replace function public.qr_checkin(p_token text)
returns text language plpgsql security definer set search_path = public as $$
declare s services; pid uuid;
begin
  select sv.* into s from service_checkin_tokens t join services sv on sv.id = t.service_id where t.token = p_token;
  if s.id is null then raise exception 'QR Code inválido'; end if;
  pid := public._checkin_person(s);
  insert into service_attendance (service_id, person_id, church_id, marked_by, source)
    values (s.id, pid, s.church_id, auth.uid(), 'qr')
    on conflict (service_id, person_id) do nothing;
  return s.title;
end $$;
revoke execute on function public.qr_checkin from public, anon;
grant execute on function public.qr_checkin to authenticated;
