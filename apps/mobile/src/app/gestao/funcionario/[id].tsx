import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { brDateTimeToISO, brToISO, goBack, isoToBR, isoToBRDateTZ, isoToBRTime, List, Row, Toggle } from '@/components/admin';
import { Button, C, Card, Chips, F, Input, Muted, Screen, Section } from '@/components/ui';
import { useChurch } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { useData } from '@/lib/use-data';

type Emp = {
  id?: string; person_id: string | null; full_name: string; job_title: string; salary_cents: number; pay_day: number; pix_key: string | null;
  admission_date: string | null; work_days: number[]; start_time: string | null; end_time: string | null; punch_required: boolean; active: boolean; notes: string | null;
};
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const NEW: Emp = { person_id: null, full_name: '', job_title: '', salary_cents: 0, pay_day: 5, pix_key: null, admission_date: null, work_days: [1, 2, 3, 4, 5], start_time: '08:00', end_time: '17:00', punch_required: true, active: true, notes: null };
const toCents = (v: string) => { const s = v.replace(/[^\d,.]/g, ''); const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s); return Number.isFinite(n) ? Math.round(n * 100) : NaN; };

/** Cadastro do funcionário (id = "novo") e correção do ponto. */
export default function Funcionario() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useData(async () => {
    if (id === 'novo') return NEW;
    const { data: e } = await supabase.from('employees').select('*').eq('id', id).maybeSingle();
    return e as Emp | null;
  }, null as Emp | null, `emp:${id}`);
  if (!data) return <Screen><Muted>Carregando…</Muted></Screen>;
  return <Form initial={data} />;
}

function Form({ initial }: { initial: Emp }) {
  const { church, color } = useChurch();
  const editing = !!initial.id;
  const [f, setF] = useState({
    full_name: initial.full_name, job_title: initial.job_title, salary: initial.salary_cents ? (initial.salary_cents / 100).toFixed(2).replace('.', ',') : '',
    pay_day: String(initial.pay_day), pix_key: initial.pix_key ?? '', admission: isoToBR(initial.admission_date), start: initial.start_time?.slice(0, 5) ?? '',
    end: initial.end_time?.slice(0, 5) ?? '', notes: initial.notes ?? '',
  });
  const [days, setDays] = useState<number[]>(initial.work_days);
  const [punch, setPunch] = useState(initial.punch_required);
  const [active, setActive] = useState(initial.active);
  const [person, setPerson] = useState(initial.person_id);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((o) => ({ ...o, [k]: v }));
  const { data: people } = useData(async () => {
    const { data: rows } = await supabase.rpc('employee_people', { p_church: church.id });
    return (rows ?? []) as { id: string; full_name: string; has_app: boolean }[];
  }, [] as { id: string; full_name: string; has_app: boolean }[], `emppeople:${church.id}`);
  const linked = people.find((p) => p.id === person);
  const matches = q.trim().length >= 2 ? people.filter((p) => p.full_name.toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];

  async function save() {
    const salary = f.salary.trim() ? toCents(f.salary) : 0;
    if (Number.isNaN(salary)) return Alert.alert('Salário', 'Digite o valor, ex.: 1.800,00');
    if (f.full_name.trim().length < 2 || f.job_title.trim().length < 2) return Alert.alert('Faltou', 'Preencha nome e cargo.');
    if (f.admission.trim() && !brToISO(f.admission)) return Alert.alert('Admissão', 'Use dd/mm/aaaa.');
    setBusy(true);
    const row = {
      church_id: church.id, person_id: person, full_name: f.full_name.trim(), job_title: f.job_title.trim(), salary_cents: salary,
      pay_day: Math.min(31, Math.max(1, Number(f.pay_day) || 5)), pix_key: f.pix_key.trim() || null,
      admission_date: f.admission.trim() ? brToISO(f.admission) : null, work_days: [...days].sort(),
      start_time: f.start.trim() || null, end_time: f.end.trim() || null, punch_required: punch, active, notes: f.notes.trim() || null,
    };
    const { error } = editing ? await supabase.from('employees').update(row).eq('id', initial.id!) : await supabase.from('employees').insert(row);
    if (!error) await supabase.rpc('payroll_generate', { p_church: church.id });
    setBusy(false);
    if (error) return Alert.alert('Não deu', error.message.includes('employees_church_id_user_id_key') ? 'Essa pessoa já está cadastrada como funcionário.' : error.message);
    Alert.alert('Salvo', editing ? 'Cadastro atualizado.' : 'Funcionário cadastrado. O salário deste mês já está em Contas a pagar.');
    goBack('/gestao/funcionarios');
  }

  return (
    <Screen color={color}>
      <Stack.Screen options={{ title: editing ? initial.full_name.split(' ')[0] : 'Novo funcionário' }} />
      <Card>
        <Input label="Nome completo" value={f.full_name} onChangeText={set('full_name')} />
        <Input label="Cargo" value={f.job_title} onChangeText={set('job_title')} placeholder="Secretária, zelador…" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 2 }}><Input label="Salário (R$)" value={f.salary} onChangeText={set('salary')} keyboardType="decimal-pad" placeholder="0,00" /></View>
          <View style={{ flex: 1 }}><Input label="Dia do pagamento" value={f.pay_day} onChangeText={set('pay_day')} keyboardType="number-pad" /></View>
        </View>
        <Input label="Chave Pix (para pagar)" value={f.pix_key} onChangeText={set('pix_key')} autoCapitalize="none" />
        <Input label="Admissão" value={f.admission} onChangeText={set('admission')} placeholder="dd/mm/aaaa" />
      </Card>

      <Section title="Jornada">
        <Card>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {DAYS.map((d, i) => {
              const on = days.includes(i);
              return (
                <Pressable key={d} onPress={() => setDays(on ? days.filter((x) => x !== i) : [...days, i])} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? color : C.bg, borderWidth: 1, borderColor: on ? color : C.line }}>
                  <Text style={{ fontFamily: F.semibold, fontSize: 13, color: on ? '#fff' : C.text }}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><Input label="Entrada" value={f.start} onChangeText={set('start')} placeholder="08:00" /></View>
            <View style={{ flex: 1 }}><Input label="Saída" value={f.end} onChangeText={set('end')} placeholder="17:00" /></View>
          </View>
          <Toggle label="Bate ponto pelo app" value={punch} onChange={setPunch} color={color} hint="Precisa estar ligado a uma pessoa com conta no app." />
          {editing && <Toggle label="Ativo" value={active} onChange={setActive} color={color} hint="Desligue quando a pessoa sair. O histórico fica guardado." />}
        </Card>
      </Section>

      <Section title="Conta no app">
        <Card>
          {linked ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ flex: 1, fontFamily: F.semibold, fontSize: 15, color: C.text }}>{linked.full_name}{linked.has_app ? '' : ' (sem conta no app)'}</Text>
              <Pressable onPress={() => setPerson(null)} hitSlop={8}><Text style={{ fontFamily: F.bold, color: C.danger }}>Desligar</Text></Pressable>
            </View>
          ) : (
            <>
              <Input label="Ligar a uma pessoa do cadastro" value={q} onChangeText={setQ} placeholder="Buscar nome" />
              {matches.map((p) => (
                <Pressable key={p.id} onPress={() => { setPerson(p.id); setQ(''); }} style={{ paddingVertical: 8 }}>
                  <Text style={{ fontFamily: F.medium, fontSize: 15, color: C.text }}>{p.full_name}<Text style={{ color: C.muted }}>{p.has_app ? ' · tem o app' : ''}</Text></Text>
                </Pressable>
              ))}
            </>
          )}
        </Card>
      </Section>

      <Input label="Observações" value={f.notes} onChangeText={set('notes')} multiline />
      <Button title={editing ? 'Salvar' : 'Cadastrar funcionário'} color={color} loading={busy} onPress={save} />
      {editing && <Punches employeeId={initial.id!} churchId={church.id} color={color} />}
    </Screen>
  );
}

function Punches({ employeeId, churchId, color }: { employeeId: string; churchId: string; color: string }) {
  const { user } = useChurch();
  const [kind, setKind] = useState<'entrada' | 'saida'>('entrada');
  const [d, setD] = useState('');
  const [t, setT] = useState('');
  const { data, reload } = useData(async () => {
    const { data: rows } = await supabase.from('time_punches').select('id, kind, at, source').eq('employee_id', employeeId).order('at', { ascending: false }).limit(30);
    return (rows ?? []) as { id: string; kind: string; at: string; source: string }[];
  }, [] as { id: string; kind: string; at: string; source: string }[], `punch:${employeeId}`);
  async function add() {
    const at = brDateTimeToISO(d, t);
    if (!at) return Alert.alert('Data e hora', 'Use dd/mm/aaaa e hh:mm.');
    const { error } = await supabase.from('time_punches').insert({ church_id: churchId, employee_id: employeeId, kind, at, source: 'manual', created_by: user.id });
    if (error) return Alert.alert('Não deu', error.message);
    setD(''); setT(''); reload();
  }
  return (
    <Section title="Ponto">
      <Card>
        <Text style={{ fontFamily: F.bold, fontSize: 15, color: C.text }}>Lançar batida esquecida</Text>
        <Chips color={color} value={kind} onChange={setKind} options={[{ value: 'entrada', label: 'Entrada' }, { value: 'saida', label: 'Saída' }]} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 3 }}><Input label="Dia" value={d} onChangeText={setD} placeholder="dd/mm/aaaa" /></View>
          <View style={{ flex: 2 }}><Input label="Hora" value={t} onChangeText={setT} placeholder="08:00" /></View>
        </View>
        <Button title="Lançar" variant="outline" color={color} onPress={add} />
      </Card>
      <List>
        {data.length === 0 && <Row first title="Nenhuma batida ainda." />}
        {data.map((p, i) => (
          <Row key={p.id} first={i === 0} title={`${p.kind === 'entrada' ? 'Entrada' : 'Saída'} · ${isoToBRDateTZ(p.at)} ${isoToBRTime(p.at)}`} sub={p.source === 'manual' ? 'lançada à mão' : 'pelo app'} />
        ))}
      </List>
      <Pressable onPress={() => router.push('/equipe')} style={{ alignItems: 'center', padding: 6 }}>
        <Text style={{ fontFamily: F.bold, fontSize: 14, color }}>Ver quem está trabalhando agora</Text>
      </Pressable>
    </Section>
  );
}
