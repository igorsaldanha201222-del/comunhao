-- =====================================================================
-- Financeiro: contas, categorias, lançamentos (entradas/saídas) com nota
-- anexada, histórico de alterações e entrada automática das doações online.
-- =====================================================================

create type public.entry_type   as enum ('entrada', 'saida');
create type public.entry_status as enum ('pago', 'pendente');

create or replace function public.is_finance(p_church uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(p_church, array['owner','admin','treasurer']::public.member_role[]);
$$;

-- Contas (caixa, banco, gateway online)
create table public.finance_accounts (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches(id) on delete cascade,
  name            text not null,
  kind            text not null default 'banco' check (kind in ('caixa','banco','online')),
  opening_cents   bigint not null default 0,      -- saldo inicial
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (church_id, name)
);

create table public.finance_categories (
  id         uuid primary key default gen_random_uuid(),
  church_id  uuid not null references public.churches(id) on delete cascade,
  type       public.entry_type not null,
  name       text not null,
  active     boolean not null default true,
  unique (church_id, type, name)
);

create table public.finance_entries (
  id              uuid primary key default gen_random_uuid(),
  church_id       uuid not null references public.churches(id) on delete cascade,
  type            public.entry_type not null,
  status          public.entry_status not null default 'pago',
  entry_date      date not null default current_date,        -- data do pagamento/recebimento
  due_date        date,                                      -- vencimento (contas a pagar)
  amount_cents    bigint not null check (amount_cents > 0),
  description     text not null,
  category_id     uuid references public.finance_categories(id) on delete set null,
  account_id      uuid references public.finance_accounts(id) on delete set null,
  counterparty    text,           -- fornecedor (saída) ou de quem veio (entrada)
  counterparty_doc text,          -- CPF/CNPJ
  document_type   text check (document_type in ('nota_fiscal','recibo','cupom','boleto','fatura','outro')),
  document_number text,
  payment_method  text check (payment_method in ('dinheiro','pix','cartao','boleto','transferencia','cheque','debito_automatico')),
  attachment_path text,           -- caminho no bucket privado `finance`
  notes           text,
  source          text not null default 'manual' check (source in ('manual','online')),
  payment_id      uuid unique references public.payments(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_by      uuid references auth.users(id) on delete set null,
  updated_at      timestamptz not null default now()
);
create index on public.finance_entries (church_id, entry_date desc);
create index on public.finance_entries (church_id, status, due_date);

-- Histórico: quem criou, alterou ou excluiu cada lançamento (prestação de contas).
create table public.finance_audit (
  id         bigint generated always as identity primary key,
  church_id  uuid not null,
  entry_id   uuid not null,
  action     text not null check (action in ('criou','alterou','excluiu')),
  by_user    uuid,
  at         timestamptz not null default now(),
  before     jsonb,
  after      jsonb
);
create index on public.finance_audit (church_id, entry_id, at desc);

create or replace function public.finance_audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into finance_audit (church_id, entry_id, action, by_user, after) values (new.church_id, new.id, 'criou', auth.uid(), to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    new.updated_at := now();
    new.updated_by := auth.uid();
    -- Lançamento vindo do gateway não muda valor/data/tipo pela tela.
    if old.source = 'online' and coalesce(auth.role(), '') <> 'service_role' and
       (new.amount_cents, new.entry_date, new.type, new.status) is distinct from (old.amount_cents, old.entry_date, old.type, old.status) then
      raise exception 'lançamento de pagamento online não pode ter valor, data, tipo ou situação alterados';
    end if;
    insert into finance_audit (church_id, entry_id, action, by_user, before, after) values (new.church_id, new.id, 'alterou', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  else
    if old.source = 'online' and coalesce(auth.role(), '') <> 'service_role' then
      raise exception 'lançamento de pagamento online não pode ser excluído';
    end if;
    insert into finance_audit (church_id, entry_id, action, by_user, before) values (old.church_id, old.id, 'excluiu', auth.uid(), to_jsonb(old));
    return old;
  end if;
end $$;

create trigger finance_entries_audit_ins after insert on public.finance_entries for each row execute function public.finance_audit_trigger();
create trigger finance_entries_audit_upd before update on public.finance_entries for each row execute function public.finance_audit_trigger();
create trigger finance_entries_audit_del before delete on public.finance_entries for each row execute function public.finance_audit_trigger();

alter table public.finance_accounts   enable row level security;
alter table public.finance_categories enable row level security;
alter table public.finance_entries    enable row level security;
alter table public.finance_audit      enable row level security;

create policy fin_accounts   on public.finance_accounts   for all using (public.is_finance(church_id)) with check (public.is_finance(church_id));
create policy fin_categories on public.finance_categories for all using (public.is_finance(church_id)) with check (public.is_finance(church_id));
create policy fin_entries    on public.finance_entries    for all using (public.is_finance(church_id)) with check (public.is_finance(church_id));
create policy fin_audit_read on public.finance_audit      for select using (public.is_finance(church_id));

-- Tesoureiro também vê os pagamentos online e os fundos.
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments for select using (user_id = auth.uid() or public.is_finance(church_id));

-- Doação/inscrição paga no gateway vira lançamento de entrada automaticamente.
create or replace function public.payment_to_entry()
returns trigger language plpgsql security definer set search_path = public as $$
declare acc uuid; cat uuid; fund_name text; descr text;
begin
  if new.status <> 'pago' or old.status = 'pago' then return new; end if;

  select id into acc from finance_accounts where church_id = new.church_id and kind = 'online' order by created_at limit 1;
  if acc is null then
    insert into finance_accounts (church_id, name, kind) values (new.church_id, 'Conta online (Pix/cartão/boleto)', 'online')
    on conflict (church_id, name) do update set kind = 'online' returning id into acc;
  end if;

  if new.kind = 'inscricao' then
    fund_name := 'Eventos';
    select 'Inscrição: ' || e.title into descr from registrations r join events e on e.id = r.event_id where r.id = new.registration_id;
  else
    select name into fund_name from donation_funds where id = new.fund_id;
    descr := coalesce(fund_name, 'Doação') || ' online';
  end if;
  select id into cat from finance_categories where church_id = new.church_id and type = 'entrada' and name = fund_name;
  if cat is null then
    select id into cat from finance_categories where church_id = new.church_id and type = 'entrada' and name = 'Doações';
  end if;

  insert into finance_entries (church_id, type, status, entry_date, amount_cents, description, category_id, account_id,
                               counterparty, payment_method, source, payment_id)
  values (new.church_id, 'entrada', 'pago', (coalesce(new.paid_at, now()) at time zone 'America/Sao_Paulo')::date,
          new.amount_cents, coalesce(descr, 'Pagamento online'), cat, acc, new.payer_name,
          case new.method when 'cartao' then 'cartao' when 'boleto' then 'boleto' else 'pix' end, 'online', new.id)
  on conflict (payment_id) do nothing;
  return new;
end $$;
create trigger payments_to_entry after update of status on public.payments
for each row execute function public.payment_to_entry();

-- Contas e categorias padrão para igrejas novas e existentes.
create or replace function public.seed_finance(p_church uuid)
returns void language sql security definer set search_path = public as $$
  insert into finance_accounts (church_id, name, kind) values
    (p_church, 'Caixa (dinheiro)', 'caixa'), (p_church, 'Conta bancária', 'banco'),
    (p_church, 'Conta online (Pix/cartão/boleto)', 'online')
  on conflict do nothing;
  insert into finance_categories (church_id, type, name)
  select p_church, t::public.entry_type, n from (values
    ('entrada','Dízimo'), ('entrada','Oferta'), ('entrada','Missões'), ('entrada','Doações'),
    ('entrada','Eventos'), ('entrada','Cantina/Bazar'), ('entrada','Outras entradas'),
    ('saida','Aluguel'), ('saida','Energia elétrica'), ('saida','Água'), ('saida','Internet/Telefone'),
    ('saida','Prebenda/Salários'), ('saida','Encargos e impostos'), ('saida','Manutenção'),
    ('saida','Material de limpeza'), ('saida','Som e mídia'), ('saida','Ação social'),
    ('saida','Missões'), ('saida','Eventos'), ('saida','Tarifas bancárias'), ('saida','Outras saídas')
  ) as v(t, n)
  on conflict do nothing;
$$;
select public.seed_finance(id) from public.churches;

create or replace function public.seed_finance_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.seed_finance(new.id); return new; end $$;
create trigger churches_seed_finance after insert on public.churches
for each row execute function public.seed_finance_trigger();

revoke execute on function public.seed_finance from public, anon, authenticated;

-- Bucket PRIVADO para notas e comprovantes: <church_id>/<arquivo>, acesso por URL assinada.
insert into storage.buckets (id, name, public) values ('finance', 'finance', false) on conflict do nothing;
create policy finance_files_read on storage.objects for select to authenticated using (
  bucket_id = 'finance' and public.is_finance(((storage.foldername(name))[1])::uuid)
);
create policy finance_files_write on storage.objects for insert to authenticated with check (
  bucket_id = 'finance' and public.is_finance(((storage.foldername(name))[1])::uuid)
);
create policy finance_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'finance' and public.is_finance(((storage.foldername(name))[1])::uuid)
);

-- Tesoureiro vê o nome de quem mexeu nos lançamentos (histórico).
drop policy if exists profiles_staff_read on public.profiles;
create policy profiles_staff_read on public.profiles for select using (
  exists (select 1 from public.memberships m
          where m.user_id = profiles.id and (public.is_staff(m.church_id) or public.is_finance(m.church_id)))
);
