import Link from "next/link";

const TABS = [["", "Check-in de hoje"], ["/criancas", "Crianças"], ["/aulas", "Aulas e atividades"]] as const;

export function KidsTabs({ slug, active }: { slug: string; active: "" | "/criancas" | "/aulas" }) {
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl bg-zinc-100 p-1 text-sm">
      {TABS.map(([href, label]) => (
        <Link key={href} href={`/painel/${slug}/kids${href}`}
          className={`whitespace-nowrap rounded-lg px-3 py-2 ${active === href ? "bg-white font-semibold shadow-sm" : "text-zinc-600"}`}>
          {label}
        </Link>
      ))}
    </div>
  );
}
