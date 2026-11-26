"use client";
import { useState } from "react";
import { ActionForm, Submit } from "@/components/form";
import { Field } from "@/components/ui";
import { LOCATIONS, PRIORITIES } from "@/lib/maintenance";
import { createRequest } from "./actions";

/** Abrir chamado: foto (câmera no celular), o que fazer, onde e a urgência. */
export function RequestForm({ slug }: { slug: string }) {
  const [previews, setPreviews] = useState<string[]>([]);
  return (
    <ActionForm action={createRequest} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="slug" value={slug} />
      <Field label="Fotos do problema" className="sm:col-span-2">
        <input name="photos" type="file" accept="image/*" capture="environment" multiple className="text-sm"
          onChange={(e) => setPreviews([...(e.target.files ?? [])].slice(0, 6).map((f) => URL.createObjectURL(f)))} />
        {previews.length > 0 && (
          <div className="mt-2 flex gap-2 overflow-x-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {previews.map((src) => <img key={src} src={src} alt="" className="h-20 w-20 rounded-lg object-cover" />)}
          </div>
        )}
      </Field>
      <Field label="O que precisa ser feito?" className="sm:col-span-2">
        <input name="title" required minLength={3} maxLength={120} placeholder="ex.: Trocar lâmpada queimada do palco" className="input" />
      </Field>
      <Field label="Onde?">
        <input name="location" list="maint-locations" maxLength={120} placeholder="ex.: Salão social" className="input" />
        <datalist id="maint-locations">{LOCATIONS.map((l) => <option key={l} value={l} />)}</datalist>
      </Field>
      <Field label="Urgência">
        <select name="priority" defaultValue="normal" className="input">
          {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </Field>
      <Field label="Detalhes (como fazer, o que comprar, etc.)" className="sm:col-span-2">
        <textarea name="description" rows={3} maxLength={4000} className="input"
          placeholder="ex.: São 2 lâmpadas LED de 20W, tem escada no depósito." />
      </Field>
      <div className="sm:col-span-2"><Submit>Enviar chamado</Submit></div>
    </ActionForm>
  );
}
