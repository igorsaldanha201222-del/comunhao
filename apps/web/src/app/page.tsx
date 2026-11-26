import Link from "next/link";
import { BRAND } from "@/lib/brand";

const MODULES = [
  ["Pessoas", "Membros, visitantes e novos convertidos em um cadastro só, com histórico e atendimento pastoral."],
  ["Ministérios e escalas", "Louvor, diaconato, mídia, recepção… cada um com líderes, funções, escalas e repertório."],
  ["Comunicação", "Pregações, banners e notificações push direto no celular dos membros."],
  ["Eventos", "Inscrições gratuitas ou pagas, controle de vagas e check-in por QR Code."],
  ["Generosidade", "Dízimos e ofertas por Pix, cartão ou boleto, com repasse automático para a igreja."],
  ["Energia solar", "Monitore o sistema fotovoltaico da igreja: geração, falhas e alertas em tempo real."],
];

export default function Home() {
  return (
    <main>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold">{BRAND.name}</span>
        <nav className="flex gap-2">
          <Link href="/login" className="btn-ghost">Entrar</Link>
          <Link href="/cadastro" className="btn-primary">Cadastrar igreja</Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12">
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">{BRAND.tagline}</h1>
        <p className="mt-5 max-w-2xl text-lg text-zinc-600">
          Aplicativo para os membros, site da igreja e painel de gestão para a liderança. Tudo na nuvem, sem instalar nada.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/cadastro" className="btn-primary px-6 py-3 text-base">Começar grátis</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(([t, d]) => (
          <div key={t} className="card">
            <h2 className="font-semibold">{t}</h2>
            <p className="mt-2 text-sm text-zinc-600">{d}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-zinc-200 py-8 text-center text-sm text-zinc-500">
        {BRAND.name} · {BRAND.supportEmail}
      </footer>
    </main>
  );
}
