import { ActionForm, Submit } from "@/components/form";
import { Field } from "@/components/ui";
import { savePerson } from "../actions";

type Person = Record<string, string | null>;

export function PersonForm({ slug, person }: { slug: string; person?: Person }) {
  const p = person ?? {};
  return (
    <ActionForm action={savePerson} reset={!person} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="slug" value={slug} />
      {p.id && <input type="hidden" name="id" value={p.id} />}
      <Field label="Nome completo" className="sm:col-span-2"><input name="full_name" defaultValue={p.full_name ?? ""} required className="input" /></Field>
      <Field label="E-mail"><input name="email" type="email" defaultValue={p.email ?? ""} className="input" /></Field>
      <Field label="Telefone"><input name="phone" defaultValue={p.phone ?? ""} className="input" /></Field>
      <Field label="Nascimento"><input name="birth_date" type="date" defaultValue={p.birth_date ?? ""} className="input" /></Field>
      <Field label="Sexo">
        <select name="gender" defaultValue={p.gender ?? ""} className="input">
          <option value="">—</option><option value="F">Feminino</option><option value="M">Masculino</option>
        </select>
      </Field>
      <Field label="Situação">
        <select name="status" defaultValue={p.status ?? "visitante"} className="input">
          <option value="visitante">Visitante</option>
          <option value="novo_convertido">Novo convertido</option>
          <option value="membro">Membro</option>
          <option value="inativo">Inativo</option>
        </select>
      </Field>
      <Field label="Estado civil"><input name="marital_status" defaultValue={p.marital_status ?? ""} className="input" /></Field>
      <Field label="Batismo"><input name="baptized_at" type="date" defaultValue={p.baptized_at ?? ""} className="input" /></Field>
      <Field label="Endereço"><input name="address" defaultValue={p.address ?? ""} className="input" /></Field>
      <Field label="Observações" className="sm:col-span-2"><textarea name="notes" rows={3} defaultValue={p.notes ?? ""} className="input" /></Field>
      <div className="sm:col-span-2"><Submit>{person ? "Salvar alterações" : "Cadastrar pessoa"}</Submit></div>
    </ActionForm>
  );
}
