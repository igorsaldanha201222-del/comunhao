"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

/** Barra do painel no celular: nome da igreja + menu ☰ que abre a lista de páginas. */
export function MobileNav({ items, base, title, logo, footer }: {
  items: [string, string][]; base: string; title: string; logo: ReactNode; footer: ReactNode;
}) {
  const path = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path; // fecha sozinho ao trocar de página
  const current = items.find(([href]) => (href === "" ? path === base : path.startsWith(base + href)))?.[1];

  return (
    <div className="sticky top-0 z-40 border-b border-zinc-200 bg-white md:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {logo}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{title}</p>
            {current && <p className="truncate text-xs text-zinc-500">{current}</p>}
          </div>
        </div>
        <button type="button" onClick={() => setOpenAt(open ? null : path)} aria-expanded={open} aria-label="Menu"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-xl">
          {open ? "✕" : "☰"}
        </button>
      </div>
      {open && (
        <nav className="max-h-[75vh] overflow-y-auto border-t border-zinc-100 px-2 pb-3 pt-1">
          {items.map(([href, label]) => {
            const active = label === current;
            return (
              <Link key={href} href={base + href}
                className={`block rounded-lg px-3 py-3 text-[15px] ${active ? "bg-zinc-100 font-semibold" : "text-zinc-700"}`}>
                {label}
              </Link>
            );
          })}
          <div className="mt-2 border-t border-zinc-100 px-3 pt-3 text-sm text-zinc-500">{footer}</div>
        </nav>
      )}
    </div>
  );
}
