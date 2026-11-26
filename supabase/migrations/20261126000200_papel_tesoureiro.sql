-- Papel de tesoureiro: acessa o financeiro sem administrar a igreja.
-- (Em migration própria: valor novo de enum não pode ser usado na mesma transação.)
alter type public.member_role add value if not exists 'treasurer';
