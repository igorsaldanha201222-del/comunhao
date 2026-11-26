export type MaintStatus = "aberta" | "em_andamento" | "aguardando" | "concluida" | "cancelada";
export type MaintPriority = "baixa" | "normal" | "alta" | "urgente";

/** Colunas do quadro, na ordem. "cancelada" fica fora do quadro. */
export const COLUMNS: { status: MaintStatus; label: string; hint: string }[] = [
  { status: "aberta", label: "Novos", hint: "Chegaram e ninguém pegou ainda" },
  { status: "em_andamento", label: "Em andamento", hint: "Alguém já está resolvendo" },
  { status: "aguardando", label: "Aguardando", hint: "Material, orçamento ou terceiro" },
  { status: "concluida", label: "Concluídos", hint: "Resolvidos nos últimos 30 dias" },
];

export const MAINT_STATUS_LABEL: Record<MaintStatus, string> = {
  aberta: "Novo", em_andamento: "Em andamento", aguardando: "Aguardando", concluida: "Concluído", cancelada: "Cancelado",
};

export const PRIORITIES: { value: MaintPriority; label: string; tone: "zinc" | "amber" | "red" | "green" }[] = [
  { value: "baixa", label: "Baixa", tone: "zinc" },
  { value: "normal", label: "Normal", tone: "zinc" },
  { value: "alta", label: "Alta", tone: "amber" },
  { value: "urgente", label: "Urgente", tone: "red" },
];
export const priorityOf = (p: string) => PRIORITIES.find((x) => x.value === p) ?? PRIORITIES[1];

export const LOCATIONS = ["Templo", "Salão social", "Cozinha", "Banheiros", "Salas de aula", "Estacionamento", "Telhado", "Área externa"];

export type MaintPerson = { user_id: string; full_name: string; can_manage: boolean };
