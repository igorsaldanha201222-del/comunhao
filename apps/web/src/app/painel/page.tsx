import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm, Submit } from "@/components/form";
import { Field } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { STATUS_LABEL } from "@/lib/format";
import { createChurch, logout } from "../(auth)/actions";

export const metadata = { title: "Minhas igrejas" };

export default async function PainelHome({ searchParams }: PageProps<"/painel">) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships").select("role, maint_request, maint_manage, churches(slug, name)").eq("user_id", user.id);
  const staff = (data ?? []).filter((m) => m.role !== "member" || m.maint_request || m.maint_manage) as unknown as {
    role: string; churches: { slug: string; name: string };
  }[];
  const { erro } = await searchParams;

  if (staff.length === 1 && !erro) redirect(`/painel/${staff[0].churches.slug}`);

  return (
    <main className="mx-auto max-w-lg px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <span className="text-lg font-semibold">{BRAND.name}</span>
        <form action={logout}><button className="btn-ghost">Sair</button></form>
      </div>
      {erro === "sem-acesso" && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Você não tem acesso ao painel dessa igreja. Peça a um administrador para te dar o papel de líder.
        </p>
      )}
      {staff.length > 0 && (
        <>
          <h1 className="text-xl font-semibold">Suas igrejas</h1>
          <ul className="mt-4 space-y-2">
            {staff.map((m) => (
              <li key={m.churches.slug}>
                <Link href={`/painel/${m.churches.slug}`} className="card flex justify-between hover:border-zinc-400">
                  <span className="font-medium">{m.churches.name}</span>
                  <span className="text-sm text-zinc-500">{m.role === "member" ? "Manutenção" : STATUS_LABEL[m.role]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <h2 className="mt-10 text-lg font-semibold">Cadastrar uma igreja</h2>
      <ActionForm action={createChurch} className="mt-4 space-y-3" reset={false}>
        <Field label="Nome da igreja"><input name="church_name" required className="input" /></Field>
        <Field label="Código (ex.: igreja-esperanca)"><input name="slug" required pattern="[a-z0-9\-]{3,40}" className="input" /></Field>
        <Submit>Criar igreja</Submit>
      </ActionForm>
    </main>
  );
}
