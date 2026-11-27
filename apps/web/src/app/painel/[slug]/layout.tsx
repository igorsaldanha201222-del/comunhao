import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { logout } from "../../(auth)/actions";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";

// [rota, rótulo, quem vê]: S = equipe (owner/admin/leader), F = financeiro (owner/admin/treasurer),
// M = manutenção (quem o pastor liberou para abrir ou cuidar dos chamados)
const NAV: [string, string, string][] = [
  ["", "Início", "SF"],
  ["/pessoas", "Pessoas", "S"],
  ["/engajamento", "Engajamento", "S"],
  ["/membresia", "Quero ser membro", "S"],
  ["/ministerios", "Ministérios", "S"],
  ["/presenca", "Presença no culto", "P"],
  ["/eventos", "Eventos", "S"],
  ["/pregacoes", "Pregações", "S"],
  ["/aovivo", "Ao vivo", "S"],
  ["/devocionais", "Devocionais", "S"],
  ["/banners", "Banners", "S"],
  ["/notificacoes", "Notificações", "S"],
  ["/oracoes", "Pedidos de oração", "S"],
  ["/financeiro", "Financeiro", "F"],
  ["/doacoes", "Doações online", "F"],
  ["/funcionarios", "Funcionários", "F"],
  ["/kids", "Kids", "K"],
  ["/manutencao", "Manutenção", "M"],
  ["/solar", "Energia solar", "S"],
  ["/configuracoes", "Configurações", "S"],
];

export default async function PainelLayout({ children, params }: LayoutProps<"/painel/[slug]">) {
  const { slug } = await params;
  const { church, user, isStaff, canFinance, canMaintRequest, canKids, canAttendance } = await requireStaff(slug);
  const nav = NAV.filter(([, , who]) =>
    (who.includes("S") && isStaff) || (who.includes("F") && canFinance) || (who.includes("M") && canMaintRequest) || (who.includes("K") && canKids) || (who.includes("P") && canAttendance));
  const base = `/painel/${slug}`;
  return (
    <div className="flex min-h-screen overflow-x-clip" style={{ ["--brand" as string]: church.primary_color }}>
      <aside className="sticky top-0 hidden print:!hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-zinc-200 bg-white md:flex">
        <div className="border-b border-zinc-200 p-4">
          <div className="flex items-center gap-2">
            {church.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={church.logo_url} alt="" className="h-8 w-8 rounded object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded bg-brand text-sm font-bold text-white">
                {church.name[0]}
              </span>
            )}
            <span className="truncate text-sm font-semibold">{church.name}</span>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {nav.map(([href, label]) => (
            <NavLink key={href} href={base + href} exact={href === ""}>{label}</NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-zinc-200 p-4 text-xs text-zinc-500">
          <Link href={`/i/${slug}`} target="_blank" className="block underline">Ver site da igreja</Link>
          <p className="truncate">{user.email}</p>
          <form action={logout}><button className="underline">Sair</button></form>
          <p className="pt-2 text-zinc-400">{BRAND.name}</p>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <MobileNav
          items={nav.map(([href, label]) => [href, label] as [string, string])}
          base={base}
          title={church.name}
          logo={church.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={church.logo_url} alt="" className="h-8 w-8 rounded object-cover" />
            : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-brand text-sm font-bold text-white">{church.name[0]}</span>}
          footer={<>
            <Link href={`/i/${slug}`} target="_blank" className="block py-1 underline">Ver site da igreja</Link>
            <p className="truncate py-1">{user.email}</p>
            <form action={logout}><button className="py-1 underline">Sair</button></form>
          </>}
        />
        <main className="mx-auto max-w-6xl px-4 py-5 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
