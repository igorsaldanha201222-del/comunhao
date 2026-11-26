import { ActionForm, Submit } from "@/components/form";
import { Field } from "@/components/ui";
import { toLocalInput } from "@/lib/format";
import { saveEvent } from "../actions";

type Ev = {
  id: string; title: string; description: string | null; location: string | null; starts_at: string;
  ends_at: string | null; capacity: number | null; price_cents: number; published: boolean;
};

export function EventForm({ slug, ev }: { slug: string; ev?: Ev }) {
  return (
    <ActionForm action={saveEvent} reset={!ev} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="slug" value={slug} />
      {ev && <input type="hidden" name="id" value={ev.id} />}
      <Field label="Título" className="sm:col-span-2"><input name="title" defaultValue={ev?.title} required className="input" /></Field>
      <Field label="Início"><input name="starts_at" type="datetime-local" defaultValue={toLocalInput(ev?.starts_at)} required className="input" /></Field>
      <Field label="Término"><input name="ends_at" type="datetime-local" defaultValue={toLocalInput(ev?.ends_at)} className="input" /></Field>
      <Field label="Local" className="sm:col-span-2"><input name="location" defaultValue={ev?.location ?? ""} className="input" /></Field>
      <Field label="Vagas (vazio = ilimitado)"><input name="capacity" type="number" min={1} defaultValue={ev?.capacity ?? ""} className="input" /></Field>
      <Field label="Valor da inscrição (R$, 0 = gratuito)"><input name="price" inputMode="decimal" defaultValue={ev ? (ev.price_cents / 100).toFixed(2).replace(".", ",") : "0"} className="input" /></Field>
      <Field label="Descrição" className="sm:col-span-2"><textarea name="description" rows={4} defaultValue={ev?.description ?? ""} className="input" /></Field>
      <Field label="Imagem de capa"><input name="cover" type="file" accept="image/*" className="text-sm" /></Field>
      <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" name="published" defaultChecked={ev?.published ?? true} /> Publicado no app e no site</label>
      <div className="sm:col-span-2"><Submit>{ev ? "Salvar evento" : "Criar evento"}</Submit></div>
    </ActionForm>
  );
}
