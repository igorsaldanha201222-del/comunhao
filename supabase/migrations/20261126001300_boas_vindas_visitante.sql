-- Chegada do visitante: QR Code na entrada → "Seja bem-vindo" → cadastro em 1 minuto.
-- A pessoa já entra no app como visitante, a visita fica registrada e, se houver culto hoje,
-- a presença é marcada. A liderança vê a lista de visitantes para entrar em contato.

alter table public.people
  add column if not exists how_found    text check (length(how_found) <= 40),   -- como conheceu a igreja
  add column if not exists contacted_at timestamptz,                             -- liderança já falou com a pessoa
  add column if not exists contacted_by uuid references auth.users(id) on delete set null;

create index if not exists people_visitors_idx on public.people (church_id, created_at desc) where status = 'visitante';

-- Chamada pelo próprio visitante (logado) ao concluir as boas-vindas.
-- Vale também para quem já tinha conta: entra na igreja e marca presença no culto de hoje.
create or replace function public.welcome_visit(p_slug text, p_name text, p_phone text default null, p_how text default null)
returns public.churches language plpgsql security definer set search_path = public as $$
declare c churches; pid uuid; s services; nm text := trim(coalesce(p_name, '')); ph text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if length(nm) < 2 or length(nm) > 120 then raise exception 'Digite seu nome'; end if;
  select * into c from churches where slug = lower(trim(p_slug)) and active;
  if c.id is null then raise exception 'igreja não encontrada'; end if;

  insert into memberships (church_id, user_id, role) values (c.id, auth.uid(), 'member') on conflict do nothing;

  select id into pid from people where church_id = c.id and user_id = auth.uid();
  if pid is null then
    insert into people (church_id, user_id, full_name, email, phone, status, how_found)
    select c.id, auth.uid(), nm, case when u.email like '%@visitante.invalid' then null else u.email end, ph, 'visitante', left(p_how, 40)
    from auth.users u where u.id = auth.uid()
    returning id into pid;
  else
    -- já cadastrado: completa só o que estiver faltando
    update people set phone = coalesce(phone, ph), how_found = coalesce(how_found, left(p_how, 40))
    where id = pid;
  end if;
  update profiles set full_name = coalesce(full_name, nm), phone = coalesce(phone, ph) where id = auth.uid();

  -- culto de hoje: presença pela entrada (QR)
  select * into s from services
  where church_id = c.id and service_date = (now() at time zone 'America/Sao_Paulo')::date
  order by created_at limit 1;
  if s.id is not null then
    insert into service_attendance (service_id, person_id, church_id, source)
    values (s.id, pid, c.id, 'qr') on conflict do nothing;
  end if;
  return c;
end $$;
revoke execute on function public.welcome_visit from public, anon;
grant execute on function public.welcome_visit to authenticated;

-- Nome e logo da igreja na tela de boas-vindas (antes do login).
create or replace function public.church_welcome(p_slug text)
returns table (id uuid, name text, slug text, logo_url text, hero_url text, tagline text, primary_color text)
language sql stable security definer set search_path = public as $$
  select id, name, slug, logo_url, hero_url, tagline, primary_color from churches where slug = lower(trim(p_slug)) and active;
$$;
grant execute on function public.church_welcome to anon, authenticated;
