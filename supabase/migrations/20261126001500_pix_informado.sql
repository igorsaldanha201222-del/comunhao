-- Contribuição pelo Pix da igreja, sem processador de pagamentos:
-- o app gera o Pix com valor (BR Code), o membro paga no banco e toca "Já fiz o Pix".
-- A contribuição entra no financeiro como entrada "pendente" para a tesouraria conferir no extrato.

alter table public.finance_entries
  add column if not exists pix_txid text check (length(pix_txid) <= 25);
alter table public.finance_entries drop constraint if exists finance_entries_source_check;
alter table public.finance_entries add constraint finance_entries_source_check check (source in ('manual', 'online', 'pix_app'));

create or replace function public.pix_declare(p_church uuid, p_fund uuid, p_amount_cents bigint, p_txid text)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; pname text; fname text; cat uuid; acc uuid; eid uuid;
begin
  if not public.is_member(p_church) then raise exception 'Entre na igreja antes de contribuir'; end if;
  if p_amount_cents is null or p_amount_cents < 100 or p_amount_cents > 10000000 then raise exception 'Valor inválido'; end if;
  -- evita duplicar o mesmo aviso (toque duplo)
  if exists (select 1 from finance_entries where church_id = p_church and pix_txid = p_txid and p_txid is not null) then
    select id into eid from finance_entries where church_id = p_church and pix_txid = p_txid limit 1;
    return eid;
  end if;
  select id, full_name into pid, pname from people where church_id = p_church and user_id = auth.uid() limit 1;
  select name into fname from donation_funds where id = p_fund and church_id = p_church;
  select id into cat from finance_categories where church_id = p_church and type = 'entrada' and lower(name) = lower(coalesce(fname, 'Oferta'));
  select id into acc from finance_accounts where church_id = p_church and active and kind = 'banco' order by created_at limit 1;
  insert into finance_entries (church_id, type, status, entry_date, amount_cents, description, category_id, account_id,
                               counterparty, payment_method, source, person_id, pix_txid, created_by, updated_by)
  values (p_church, 'entrada', 'pendente', (now() at time zone 'America/Sao_Paulo')::date, p_amount_cents,
          coalesce(fname, 'Contribuição') || ' pelo Pix · ' || coalesce(pname, 'membro'),
          cat, acc, pname, 'pix', 'pix_app', pid, left(p_txid, 25), auth.uid(), auth.uid())
  returning id into eid;
  return eid;
end $$;
revoke execute on function public.pix_declare from public, anon;
grant execute on function public.pix_declare to authenticated;

-- Histórico do próprio membro (para conferir e para o imposto de renda).
create or replace function public.my_contributions(p_church uuid)
returns table (id uuid, entry_date date, amount_cents bigint, description text, category text, status public.entry_status)
language sql stable security definer set search_path = public as $$
  select e.id, e.entry_date, e.amount_cents, e.description, c.name, e.status
  from finance_entries e
  join people p on p.id = e.person_id and p.user_id = auth.uid()
  left join finance_categories c on c.id = e.category_id
  where e.church_id = p_church and e.type = 'entrada'
  order by e.entry_date desc, e.created_at desc
  limit 60;
$$;
revoke execute on function public.my_contributions from public, anon;
grant execute on function public.my_contributions to authenticated;

-- Dados do Pix da igreja para montar o QR Code no app (só para quem é da igreja).
create or replace function public.church_pix(p_church uuid)
returns table (pix_key text, name text, city text)
language sql stable security definer set search_path = public as $$
  select pix_key, name, city from churches where id = p_church and public.is_member(p_church);
$$;
revoke execute on function public.church_pix from public, anon;
grant execute on function public.church_pix to authenticated;
