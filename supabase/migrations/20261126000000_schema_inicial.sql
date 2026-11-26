-- =====================================================================
-- Comunhão — plataforma SaaS para igrejas (multi-tenant)
-- Esquema inicial: igrejas, vínculos, pessoas, comunicação, eventos,
-- doações/pagamentos, oração e push. Isolamento por church_id via RLS.
-- =====================================================================

-- gen_random_uuid() e sha256() são nativos do Postgres (sem pgcrypto).

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
create type public.member_role   as enum ('owner', 'admin', 'leader', 'member');
create type public.person_status as enum ('visitante', 'novo_convertido', 'membro', 'inativo');
create type public.payment_kind  as enum ('doacao', 'inscricao');
create type public.payment_method as enum ('pix', 'cartao', 'boleto');
create type public.payment_status as enum ('pendente', 'pago', 'cancelado', 'estornado', 'falhou');
create type public.registration_status as enum ('pendente', 'confirmada', 'cancelada');
create type public.plan_tier as enum ('gratuito', 'essencial', 'completo');

-- ---------------------------------------------------------------------
-- Igrejas (tenants)
-- ---------------------------------------------------------------------
create table public.churches (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name           text not null,
  logo_url       text,
  primary_color  text not null default '#4f46e5' check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
  about          text,
  address        text,
  city           text,
  state          text,
  phone          text,
  instagram      text,
  youtube_channel text,
  -- SaaS
  plan           public.plan_tier not null default 'gratuito',
  active         boolean not null default true,
  -- Repasse de pagamentos (subconta/carteira no gateway)
  payment_wallet_id text,
  created_at     timestamptz not null default now()
);

-- Perfil do usuário autenticado (1:1 com auth.users)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text,
  cpf         text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- Vínculo usuário × igreja com papel
create table public.memberships (
  church_id  uuid not null references public.churches(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (church_id, user_id)
);
create index on public.memberships (user_id);

-- ---------------------------------------------------------------------
-- Funções de autorização (security definer evita recursão no RLS)
-- ---------------------------------------------------------------------
create or replace function public.is_member(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where church_id = p_church and user_id = auth.uid());
$$;

create or replace function public.has_role(p_church uuid, p_roles public.member_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from memberships
    where church_id = p_church and user_id = auth.uid() and role = any(p_roles)
  );
$$;

create or replace function public.is_staff(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_church, array['owner','admin','leader']::public.member_role[]);
$$;

create or replace function public.is_admin(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_church, array['owner','admin']::public.member_role[]);
$$;

-- ---------------------------------------------------------------------
-- Pessoas (CRM da igreja)
-- ---------------------------------------------------------------------
create table public.people (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  full_name   text not null,
  email       text,
  phone       text,
  birth_date  date,
  gender      text check (gender in ('M','F')),
  status      public.person_status not null default 'visitante',
  marital_status text,
  address     text,
  baptized_at date,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (church_id, user_id)
);
create index on public.people (church_id, full_name);

-- Atendimentos pastorais
create table public.pastoral_care (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  person_id   uuid not null references public.people(id) on delete cascade,
  kind        text not null default 'pastoral' check (kind in ('pastoral','administrativo')),
  reason      text not null,
  notes       text,
  attended_by uuid references auth.users(id) on delete set null,
  happened_at timestamptz not null default now()
);
create index on public.pastoral_care (church_id, person_id);

-- Pedidos de oração
create table public.prayer_requests (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  author_name text,
  category    text not null default 'Outros',
  body        text not null,
  is_private  boolean not null default true,
  prayed_at   timestamptz,
  prayed_by   uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on public.prayer_requests (church_id, created_at desc);

-- ---------------------------------------------------------------------
-- Comunicação
-- ---------------------------------------------------------------------
create table public.sermons (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references public.churches(id) on delete cascade,
  title        text not null,
  preacher     text,
  series       text,
  description  text,
  video_url    text,
  audio_url    text,
  thumbnail_url text,
  published    boolean not null default true,
  preached_at  date not null default current_date,
  created_at   timestamptz not null default now()
);
create index on public.sermons (church_id, preached_at desc);

create table public.banners (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null references public.churches(id) on delete cascade,
  title      text not null,
  image_url  text not null,
  link_url   text,
  position   int not null default 0,
  starts_at  timestamptz,
  ends_at    timestamptz,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.banners (church_id, position);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  title       text not null,
  body        text not null,
  link_url    text,
  sent_at     timestamptz,
  sent_count  int not null default 0,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.push_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  church_id  uuid not null references public.churches(id) on delete cascade,
  platform   text,
  updated_at timestamptz not null default now()
);
create index on public.push_tokens (church_id);

-- ---------------------------------------------------------------------
-- Eventos e inscrições
-- ---------------------------------------------------------------------
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  church_id    uuid not null references public.churches(id) on delete cascade,
  title        text not null,
  description  text,
  location     text,
  cover_url    text,
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  capacity     int check (capacity is null or capacity > 0),
  price_cents  int not null default 0 check (price_cents >= 0),
  published    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index on public.events (church_id, starts_at);

create table public.registrations (
  id          uuid primary key default gen_random_uuid(),
  church_id   uuid not null references public.churches(id) on delete cascade,
  event_id    uuid not null references public.events(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  name        text not null,
  email       text,
  phone       text,
  status      public.registration_status not null default 'pendente',
  ticket_code text not null unique default replace(gen_random_uuid()::text, '-', ''),
  checked_in_at timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.registrations (event_id);

-- ---------------------------------------------------------------------
-- Financeiro: fundos de doação e pagamentos
-- ---------------------------------------------------------------------
create table public.donation_funds (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null references public.churches(id) on delete cascade,
  name       text not null,
  active     boolean not null default true,
  position   int not null default 0
);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches(id) on delete cascade,
  user_id         uuid references auth.users(id) on delete set null,
  kind            public.payment_kind not null,
  fund_id         uuid references public.donation_funds(id) on delete set null,
  registration_id uuid references public.registrations(id) on delete set null,
  amount_cents    int not null check (amount_cents >= 100),
  method          public.payment_method not null,
  status          public.payment_status not null default 'pendente',
  payer_name      text,
  provider        text not null default 'asaas',
  provider_id     text unique,
  pix_payload     text,
  pix_qr_base64   text,
  invoice_url     text,
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index on public.payments (church_id, created_at desc);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.churches        enable row level security;
alter table public.profiles        enable row level security;
alter table public.memberships     enable row level security;
alter table public.people          enable row level security;
alter table public.pastoral_care   enable row level security;
alter table public.prayer_requests enable row level security;
alter table public.sermons         enable row level security;
alter table public.banners         enable row level security;
alter table public.notifications   enable row level security;
alter table public.push_tokens     enable row level security;
alter table public.events          enable row level security;
alter table public.registrations   enable row level security;
alter table public.donation_funds  enable row level security;
alter table public.payments        enable row level security;

-- Igrejas: perfil público (site/app) legível por todos; edição só admin.
create policy churches_read   on public.churches for select using (active or public.is_member(id));
create policy churches_update on public.churches for update using (public.is_admin(id)) with check (public.is_admin(id));
-- Plano, ativação e carteira de repasse só mudam pelo backend (service role).
create or replace function public.guard_church_billing()
returns trigger language plpgsql as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and (
       new.plan is distinct from old.plan
    or new.active is distinct from old.active
    or new.payment_wallet_id is distinct from old.payment_wallet_id
    or new.slug is distinct from old.slug) then
    raise exception 'campo gerenciado pela plataforma';
  end if;
  return new;
end $$;
create trigger churches_guard_billing before update on public.churches
for each row execute function public.guard_church_billing();

-- Perfil: o próprio usuário; equipe da igreja vê perfis dos seus membros.
create policy profiles_self on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_staff_read on public.profiles for select using (
  exists (select 1 from public.memberships m where m.user_id = profiles.id and public.is_staff(m.church_id))
);

-- Vínculos: o usuário vê os seus; admin gerencia os da igreja.
create policy memberships_self  on public.memberships for select using (user_id = auth.uid() or public.is_staff(church_id));
create policy memberships_admin on public.memberships for all using (public.is_admin(church_id) and role <> 'owner') with check (public.is_admin(church_id) and role <> 'owner');

-- Pessoas: equipe gerencia; membro vê o próprio cadastro.
create policy people_staff on public.people for all using (public.is_staff(church_id)) with check (public.is_staff(church_id));
create policy people_self  on public.people for select using (user_id = auth.uid());

create policy pastoral_staff on public.pastoral_care for all using (public.is_staff(church_id)) with check (public.is_staff(church_id));

-- Oração: membro cria e vê os seus; equipe vê e marca como orado.
create policy prayer_insert on public.prayer_requests for insert with check (public.is_member(church_id) and user_id = auth.uid());
create policy prayer_read   on public.prayer_requests for select using (user_id = auth.uid() or public.is_staff(church_id));
create policy prayer_staff  on public.prayer_requests for update using (public.is_staff(church_id)) with check (public.is_staff(church_id));
create policy prayer_delete on public.prayer_requests for delete using (public.is_admin(church_id));

-- Conteúdo público (site e app sem login): só o publicado.
create policy sermons_public on public.sermons for select using (published or public.is_staff(church_id));
create policy sermons_staff  on public.sermons for all using (public.is_staff(church_id)) with check (public.is_staff(church_id));

create policy banners_public on public.banners for select using (
  (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()))
  or public.is_staff(church_id)
);
create policy banners_staff on public.banners for all using (public.is_staff(church_id)) with check (public.is_staff(church_id));

create policy events_public on public.events for select using (published or public.is_staff(church_id));
create policy events_staff  on public.events for all using (public.is_staff(church_id)) with check (public.is_staff(church_id));

create policy funds_public on public.donation_funds for select using (active or public.is_staff(church_id));
create policy funds_admin  on public.donation_funds for all using (public.is_admin(church_id)) with check (public.is_admin(church_id));

create policy notifications_staff on public.notifications for all using (public.is_staff(church_id)) with check (public.is_staff(church_id));
create policy notifications_member_read on public.notifications for select using (sent_at is not null and public.is_member(church_id));

create policy push_self on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(church_id));

-- Inscrições: criadas pela função register_for_event; usuário vê as suas; equipe gerencia.
create policy registrations_read  on public.registrations for select using (user_id = auth.uid() or public.is_staff(church_id));
create policy registrations_staff on public.registrations for update using (public.is_staff(church_id)) with check (public.is_staff(church_id));

-- Pagamentos: criados/atualizados só pelas Edge Functions (service role).
create policy payments_read on public.payments for select using (user_id = auth.uid() or public.is_admin(church_id));

-- ---------------------------------------------------------------------
-- Funções de negócio (RPC)
-- ---------------------------------------------------------------------

-- Perfil automático no cadastro
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

-- Onboarding: usuário logado cria uma igreja e vira owner
create or replace function public.create_church(p_name text, p_slug text)
returns public.churches language plpgsql security definer set search_path = public as $$
declare c churches;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  insert into churches (name, slug) values (trim(p_name), lower(trim(p_slug))) returning * into c;
  insert into memberships (church_id, user_id, role) values (c.id, auth.uid(), 'owner');
  insert into people (church_id, user_id, full_name, email, status)
    select c.id, u.id, coalesce(p.full_name, u.email), u.email, 'membro'
    from auth.users u left join profiles p on p.id = u.id where u.id = auth.uid();
  insert into donation_funds (church_id, name, position) values
    (c.id, 'Dízimo', 0), (c.id, 'Oferta', 1), (c.id, 'Missões', 2);
  return c;
end $$;

-- Membro entra numa igreja pelo código (slug) no app
create or replace function public.join_church(p_slug text)
returns public.churches language plpgsql security definer set search_path = public as $$
declare c churches;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  select * into c from churches where slug = lower(trim(p_slug)) and active;
  if c.id is null then raise exception 'igreja não encontrada'; end if;
  insert into memberships (church_id, user_id, role) values (c.id, auth.uid(), 'member')
    on conflict do nothing;
  insert into people (church_id, user_id, full_name, email, phone, status)
    select c.id, u.id, coalesce(p.full_name, u.email), u.email, p.phone, 'visitante'
    from auth.users u left join profiles p on p.id = u.id where u.id = auth.uid()
  on conflict (church_id, user_id) do nothing;
  return c;
end $$;

-- Inscrição em evento (gratuita confirma na hora; paga fica pendente até o pagamento)
create or replace function public.register_for_event(p_event uuid, p_name text, p_email text, p_phone text)
returns public.registrations language plpgsql security definer set search_path = public as $$
declare e events; r registrations; taken int;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  select * into e from events where id = p_event and published for update;
  if e.id is null then raise exception 'evento não encontrado'; end if;
  if not public.is_member(e.church_id) then raise exception 'entre na igreja antes de se inscrever'; end if;
  if e.capacity is not null then
    select count(*) into taken from registrations where event_id = e.id and status <> 'cancelada';
    if taken >= e.capacity then raise exception 'inscrições esgotadas'; end if;
  end if;
  insert into registrations (church_id, event_id, user_id, name, email, phone, status)
  values (e.church_id, e.id, auth.uid(), p_name, p_email, p_phone,
          (case when e.price_cents = 0 then 'confirmada' else 'pendente' end)::public.registration_status)
  returning * into r;
  return r;
end $$;

-- Check-in pelo código do ingresso (equipe)
create or replace function public.check_in(p_code text)
returns public.registrations language plpgsql security definer set search_path = public as $$
declare r registrations;
begin
  select * into r from registrations where ticket_code = p_code;
  if r.id is null then raise exception 'ingresso não encontrado'; end if;
  if not public.is_staff(r.church_id) then raise exception 'sem permissão'; end if;
  if r.status <> 'confirmada' then raise exception 'inscrição não confirmada (%)', r.status; end if;
  if r.checked_in_at is not null then raise exception 'check-in já feito em %', to_char(r.checked_in_at at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'); end if;
  update registrations set checked_in_at = now() where id = r.id returning * into r;
  return r;
end $$;

revoke execute on function public.create_church, public.join_church, public.register_for_event, public.check_in from anon;

-- ---------------------------------------------------------------------
-- Storage: bucket público para imagens (logos, banners, capas)
-- Caminho obrigatório: <church_id>/arquivo.ext
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('media', 'media', true) on conflict do nothing;

create policy media_read on storage.objects for select using (bucket_id = 'media');
create policy media_write on storage.objects for insert to authenticated with check (
  bucket_id = 'media' and public.is_staff(((storage.foldername(name))[1])::uuid)
);
create policy media_delete on storage.objects for delete to authenticated using (
  bucket_id = 'media' and public.is_staff(((storage.foldername(name))[1])::uuid)
);
