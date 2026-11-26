"use client";
import { useMemo, useRef, useState } from "react";

type Point = { t: string; w: number };

const W = 720, H = 220, PAD = { l: 44, r: 12, t: 12, b: 24 };
const LINE = "#257de0";

/** Potência ao longo do dia (uma série): área + linha 2px, crosshair e tooltip. */
export function PowerChart({ points, ratedKw }: { points: Point[]; ratedKw: number | null }) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { xs, ys, maxW, ticks, path, area } = useMemo(() => {
    const dayStart = new Date(points[0]?.t ?? 0); // sem pontos, o gráfico nem é desenhado
    dayStart.setHours(5, 0, 0, 0);
    const span = 15 * 3600_000; // 05h–20h
    const maxW = Math.max(ratedKw ? ratedKw * 1000 : 0, ...points.map((p) => p.w), 1000);
    const x = (t: string) => PAD.l + ((new Date(t).getTime() - dayStart.getTime()) / span) * (W - PAD.l - PAD.r);
    const y = (w: number) => PAD.t + (1 - w / maxW) * (H - PAD.t - PAD.b);
    const xs = points.map((p) => x(p.t));
    const ys = points.map((p) => y(p.w));
    const path = xs.map((px, i) => `${i ? "L" : "M"}${px.toFixed(1)},${ys[i].toFixed(1)}`).join("");
    const area = xs.length ? `${path}L${xs[xs.length - 1]},${H - PAD.b}L${xs[0]},${H - PAD.b}Z` : "";
    const ticks = [0, 0.5, 1].map((f) => ({ v: maxW * f, y: y(maxW * f) }));
    return { xs, ys, maxW, ticks, path, area };
  }, [points, ratedKw]);

  if (!points.length) {
    return <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">Sem leituras hoje.</p>;
  }

  function onMove(e: React.PointerEvent) {
    const svg = ref.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    xs.forEach((x, i) => { if (Math.abs(x - px) < Math.abs(xs[best] - px)) best = i; });
    setHover(best);
  }

  const kw = (w: number) => (w / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + " kW";
  const hours = [6, 9, 12, 15, 18];

  return (
    <div className="relative">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" role="img"
        aria-label={`Potência hoje, pico de ${kw(Math.max(...points.map((p) => p.w)))}`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t.v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="#e4e4e7" strokeWidth={1} />
            <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize={11} fill="#666666">{(t.v / 1000).toFixed(1)}</text>
          </g>
        ))}
        {hours.map((h) => {
          const x = PAD.l + ((h - 5) / 15) * (W - PAD.l - PAD.r);
          return <text key={h} x={x} y={H - 6} textAnchor="middle" fontSize={11} fill="#666666">{h}h</text>;
        })}
        <text x={4} y={PAD.t + 4} fontSize={11} fill="#666666">kW</text>
        <path d={area} fill={LINE} opacity={0.12} />
        <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <g>
            <line x1={xs[hover]} x2={xs[hover]} y1={PAD.t} y2={H - PAD.b} stroke="#191919" strokeWidth={1} opacity={0.4} />
            <circle cx={xs[hover]} cy={ys[hover]} r={4.5} fill={LINE} stroke="#fff" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs shadow-sm"
          style={{ left: `${(xs[hover] / W) * 100}%`, transform: xs[hover] > W * 0.7 ? "translateX(-105%)" : "translateX(8px)" }}>
          <div className="text-zinc-500">
            {new Date(points[hover].t).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="font-medium tabular-nums text-zinc-900">{kw(points[hover].w)}</div>
        </div>
      )}
      <p className="sr-only">Escala até {kw(maxW)}.</p>
    </div>
  );
}
