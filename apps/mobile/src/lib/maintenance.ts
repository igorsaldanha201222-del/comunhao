import { useChurch } from './session';
import { supabase } from './supabase';
import { useData } from './use-data';

export type MaintStatus = 'aberta' | 'em_andamento' | 'aguardando' | 'concluida' | 'cancelada';
export type MaintPriority = 'baixa' | 'normal' | 'alta' | 'urgente';

export const STATUS: { value: MaintStatus; label: string; color: string }[] = [
  { value: 'aberta', label: 'Novo', color: '#2563eb' },
  { value: 'em_andamento', label: 'Em andamento', color: '#b45309' },
  { value: 'aguardando', label: 'Aguardando', color: '#7c3aed' },
  { value: 'concluida', label: 'Concluído', color: '#047857' },
];
export const statusOf = (s: string) => STATUS.find((x) => x.value === s) ?? { value: s, label: 'Cancelado', color: '#6b7280' };

export const PRIORITIES: { value: MaintPriority; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'normal', label: 'Normal' },
  { value: 'alta', label: 'Alta' },
  { value: 'urgente', label: 'Urgente' },
];

export const LOCATIONS = ['Templo', 'Salão social', 'Cozinha', 'Banheiros', 'Salas de aula', 'Estacionamento', 'Área externa'];

/** O que o pastor liberou para este usuário na manutenção. */
export function useMaintAccess() {
  const { church, user } = useChurch();
  const { data } = useData(async () => {
    const { data: m } = await supabase.from('memberships').select('role, maint_request, maint_manage')
      .eq('church_id', church.id).eq('user_id', user.id).maybeSingle();
    const admin = m?.role === 'owner' || m?.role === 'admin';
    const manage = admin || !!m?.maint_manage;
    return { manage, request: manage || !!m?.maint_request };
  }, { manage: false, request: false }, `${church.id}:${user.id}`);
  return data;
}

/** Sobe a foto (uri local da câmera/galeria) para o bucket privado e devolve o caminho. */
export async function uploadPhoto(churchId: string, folder: string, uri: string, mime = 'image/jpeg') {
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
  const path = `${churchId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from('maintenance').upload(path, body, { contentType: mime });
  if (error) throw error;
  return path;
}

export const randomKey = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
