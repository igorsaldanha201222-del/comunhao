"use client";
import { useState } from "react";
import { ActionForm, Submit } from "@/components/form";
import { saveChurchLocation } from "./actions";

/** Local da igreja para a confirmação de presença pelo GPS. */
export function LocationForm({ slug, lat, lng, radius }: { slug: string; lat: number | null; lng: number | null; radius: number }) {
  const [coords, setCoords] = useState(lat != null && lng != null ? `${lat}, ${lng}` : "");
  const [msg, setMsg] = useState<string | null>(null);

  const useHere = () => {
    setMsg("Buscando sua localização…");
    navigator.geolocation.getCurrentPosition(
      (p) => { setCoords(`${p.coords.latitude.toFixed(6)}, ${p.coords.longitude.toFixed(6)}`); setMsg(`Pronto (precisão de ~${Math.round(p.coords.accuracy)} m). Agora toque em Salvar.`); },
      () => setMsg("Não foi possível pegar a localização. Libere o acesso no navegador ou cole as coordenadas."),
      { enableHighAccuracy: true, timeout: 20000 },
    );
  };

  return (
    <ActionForm action={saveChurchLocation} reset={false} className="mt-3 space-y-3">
      <input type="hidden" name="slug" value={slug} />
      <input name="coords" value={coords} onChange={(e) => setCoords(e.target.value)} placeholder="-3.7319, -38.5267" className="input font-mono" />
      <button type="button" onClick={useHere} className="btn-ghost w-full">📍 Usar minha localização atual (estando na igreja)</button>
      {msg && <p className="text-xs text-zinc-600">{msg}</p>}
      <label className="block text-sm">
        Distância aceita
        <select name="radius" defaultValue={String(radius)} className="input mt-1">
          <option value="100">100 m (prédio isolado)</option>
          <option value="150">150 m (recomendado)</option>
          <option value="250">250 m (estacionamento grande)</option>
          <option value="400">400 m</option>
        </select>
      </label>
      <Submit className="btn-primary w-full">Salvar local</Submit>
    </ActionForm>
  );
}
