-- =====================================================================
-- Engajamento: ligar contribuições à pessoa (dízimo/oferta em dinheiro
-- lançado pelo tesoureiro ou doação online), para o pastor enxergar
-- quem serve, participa e contribui — e quem está afastado.
-- =====================================================================

alter table public.finance_entries add column person_id uuid references public.people(id) on delete set null;
create index on public.finance_entries (church_id, person_id) where person_id is not null;

-- Doação online: a pessoa é quem pagou (payments.user_id → people.user_id)
create or replace function public.entry_person_from_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.person_id is null and new.payment_id is not null then
    select pe.id into new.person_id from payments p
      join people pe on pe.church_id = p.church_id and pe.user_id = p.user_id
      where p.id = new.payment_id;
  end if;
  return new;
end $$;
revoke execute on function public.entry_person_from_payment from public, anon, authenticated;
create trigger entry_person_from_payment before insert on public.finance_entries
  for each row execute function public.entry_person_from_payment();

update public.finance_entries e set person_id = pe.id
  from public.payments p join public.people pe on pe.church_id = p.church_id and pe.user_id = p.user_id
  where e.payment_id = p.id and e.person_id is null;

-- O tesoureiro não é da liderança (não lê o cadastro de pessoas): só a lista de nomes, para escolher o contribuinte.
create or replace function public.finance_people(p_church uuid)
returns table (id uuid, full_name text) language sql stable security definer set search_path = public as $$
  select p.id, p.full_name from people p
  where p.church_id = p_church and public.is_finance(p_church)
  order by p.full_name;
$$;
revoke execute on function public.finance_people from public, anon;
grant execute on function public.finance_people to authenticated;
