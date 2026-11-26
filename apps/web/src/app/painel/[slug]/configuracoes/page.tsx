import { requireStaff } from "@/lib/auth";
import { STATUS_LABEL } from "@/lib/format";
import { ActionForm, Submit } from "@/components/form";
import { Badge, Field, PageHeader } from "@/components/ui";
import { addFund, saveChurch, setRole } from "../actions";

export const metadata = { title: "Configurações" };

export default async function ConfiguracoesPage({ params }: PageProps<"/painel/[slug]/configuracoes">) {
  const { slug } = await params;
  const { church, supabase, isAdmin, user } = await requireStaff(slug);

  const [{ data: team }, { data: funds }] = await Promise.all([
    supabase.from("memberships").select("user_id, role, maint_request, maint_manage").eq("church_id", church.id),
    supabase.from("donation_funds").select("id, name, active").eq("church_id", church.id).order("position"),
  ]);
  const ids = (team ?? []).map((t) => t.user_id);
  const { data: people } = ids.length
    ? await supabase.from("people").select("user_id, full_name, email").eq("church_id", church.id).in("user_id", ids)
    : { data: [] };
  const byUser = new Map((people ?? []).map((p) => [p.user_id, p]));
  const sorted = [...(team ?? [])].sort((a, b) => ["owner", "admin", "leader", "treasurer", "member"].indexOf(a.role) - ["owner", "admin", "leader", "treasurer", "member"].indexOf(b.role));

  return (
    <>
      <PageHeader title="Configurações" subtitle={`Plano atual: ${church.plan}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 font-semibold">Identidade da igreja (app e site)</h2>
          <ActionForm action={saveChurch} reset={false} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="slug" value={slug} />
            <Field label="Nome" className="sm:col-span-2"><input name="name" defaultValue={church.name} required className="input" /></Field>
            <Field label="Logo"><input name="logo" type="file" accept="image/*" className="text-sm" /></Field>
            <Field label="Cor principal"><input name="primary_color" type="color" defaultValue={church.primary_color} className="h-10 w-20 rounded border border-zinc-300" /></Field>
            <Field label="Sobre a igreja" className="sm:col-span-2"><textarea name="about" rows={3} defaultValue={church.about ?? ""} className="input" /></Field>
            <Field label="Endereço" className="sm:col-span-2"><input name="address" defaultValue={church.address ?? ""} className="input" /></Field>
            <Field label="Cidade"><input name="city" defaultValue={church.city ?? ""} className="input" /></Field>
            <Field label="UF"><input name="state" maxLength={2} defaultValue={church.state ?? ""} className="input" /></Field>
            <Field label="Telefone / WhatsApp"><input name="phone" defaultValue={church.phone ?? ""} className="input" /></Field>
            <Field label="Instagram"><input name="instagram" defaultValue={church.instagram ?? ""} placeholder="@igreja" className="input" /></Field>
            <Field label="Canal do YouTube" className="sm:col-span-2"><input name="youtube_channel" type="url" defaultValue={church.youtube_channel ?? ""} className="input" /></Field>
            {isAdmin && <div className="sm:col-span-2"><Submit>Salvar</Submit></div>}
          </ActionForm>
        </section>

        <div className="space-y-6">
          <section className="card">
            <h2 className="font-semibold">Equipe e permissões</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Administrador: tudo. Líder: painel sem financeiro. Tesoureiro: só o financeiro. Membro: só o app.
              <br />Manutenção (qualquer papel): <strong>abre chamados</strong> com foto, ou <strong>cuida</strong> do quadro de manutenção.
            </p>
            <ul className="mt-3 divide-y divide-zinc-100 text-sm">
              {sorted.map((t) => {
                const p = byUser.get(t.user_id);
                const editable = isAdmin && t.role !== "owner" && t.user_id !== user.id;
                return (
                  <li key={t.user_id} className="flex items-center justify-between gap-2 py-2">
                    <div>
                      <p className="font-medium">{p?.full_name ?? "—"}</p>
                      <p className="text-xs text-zinc-500">{p?.email}</p>
                    </div>
                    {editable ? (
                      <ActionForm action={setRole} reset={false} className="flex flex-col items-end gap-1">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="user_id" value={t.user_id} />
                        <div className="flex items-center gap-2">
                          <select name="role" defaultValue={t.role} className="input py-1">
                            <option value="admin">Administrador</option>
                            <option value="leader">Líder</option>
                            <option value="treasurer">Tesoureiro</option>
                            <option value="member">Membro</option>
                          </select>
                          <Submit className="btn-ghost py-1 text-xs">OK</Submit>
                        </div>
                        <div className="flex gap-3 text-xs text-zinc-600">
                          <label className="flex items-center gap-1"><input type="checkbox" name="maint_request" defaultChecked={t.maint_request} /> Abre chamados</label>
                          <label className="flex items-center gap-1"><input type="checkbox" name="maint_manage" defaultChecked={t.maint_manage} /> Cuida da manutenção</label>
                        </div>
                      </ActionForm>
                    ) : (
                      <div className="flex gap-1">
                        <Badge>{STATUS_LABEL[t.role]}</Badge>
                        {t.role !== "owner" && t.role !== "admin" && t.maint_manage && <Badge tone="amber">Manutenção</Badge>}
                        {t.role !== "owner" && t.role !== "admin" && !t.maint_manage && t.maint_request && <Badge>Abre chamados</Badge>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {isAdmin && (
            <section className="card">
              <h2 className="font-semibold">Destinos de doação</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {(funds ?? []).map((f) => <Badge key={f.id}>{f.name}</Badge>)}
              </div>
              <ActionForm action={addFund} className="mt-3 flex gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input name="name" required placeholder="ex.: Construção" className="input" />
                <Submit className="btn-ghost">Adicionar</Submit>
              </ActionForm>
              <p className="mt-3 text-xs text-zinc-500">
                Os valores caem na conta da igreja pelo repasse automático do gateway. Para ativar, fale com o suporte para vincular sua carteira.
              </p>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
