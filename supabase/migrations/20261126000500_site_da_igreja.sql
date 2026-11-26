-- Site público da igreja: identidade visual e informações institucionais.
alter table public.churches
  add column if not exists accent_color  text check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  add column if not exists hero_url      text,
  add column if not exists tagline       text check (length(tagline) <= 160),
  add column if not exists service_times text check (length(service_times) <= 1000),
  add column if not exists email         text check (length(email) <= 160),
  add column if not exists pix_key       text check (length(pix_key) <= 140);

-- Liderança exibida no site (pastor titular, auxiliares, jubilados…).
create table public.church_leaders (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null references public.churches(id) on delete cascade,
  name       text not null check (length(name) between 2 and 120),
  title      text check (length(title) <= 80),
  bio        text check (length(bio) <= 1000),
  photo_url  text,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.church_leaders (church_id, position);
alter table public.church_leaders enable row level security;

create policy leaders_public_read on public.church_leaders for select using (
  exists (select 1 from public.churches c where c.id = church_id and c.active)
);
create policy leaders_admin on public.church_leaders for all
  using (public.is_admin(church_id)) with check (public.is_admin(church_id));
