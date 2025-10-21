export type ClientType = 'fixed' | 'freela' | 'agency';
export type ClientTaskStatus = 'pending' | 'in_progress' | 'under_review' | 'approved' | 'rejected' | 'completed' | 'edit_requested' | 'posted'; // Status alinhados com o Kanban

export interface Client {
  id: string;
  user_id: string;
  name: string;
  logo_url?: string | null;
  description?: string | null;
  color: string;
  type: ClientType;
  monthly_delivery_goal: number;
  contact_email?: string | null; // Adicionado
  contact_phone?: string | null; // Adicionado
  created_at: string;
  updated_at: string;
  email?: string;
  phone?: string;
  status?: string;
}

export interface ClientTask {
  id: string;
  client_id: string;
  user_id: string;
  title: string;
  description?: string | null;
  month_year_reference: string; // Ex: "2025-10"
  status: ClientTaskStatus;
  due_date?: string | null; // ISO string
  time?: string | null; // NOVO CAMPO: Formato "HH:mm"
  responsible_id?: string | null; // Novo campo: ID do responsável
  is_completed: boolean;
  completed_at?: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  tags?: { id: string; name: string; color: string }[]; // Para carregar tags associadas
  responsible?: { id: string; first_name: string; last_name: string; avatar_url: string } | null; // Para carregar dados do responsável
  image_urls?: string[] | null; // Novo campo: URLs das imagens anexadas
  edit_reason?: string | null; // Novo campo: Motivo da solicitação de edição
  is_standard_task: boolean; // Novo campo: Indica se a tarefa é padrão e deve ir para o dashboard principal
  main_task_id?: string | null; // Novo campo: ID da tarefa correspondente no dashboard principal
  public_approval_enabled: boolean; // Adicionado
  public_approval_link_id?: string | null; // NOVO: unique_id do link de aprovação pública
  subtasks?: ClientTask[]; // Adicionado para subtarefas
}

export interface ClientTaskGenerationPattern {
  week: number; // 1, 2, 3, 4
  day_of_week: "Sunday" | "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday"; // Dia da semana
  count: number; // Quantidade de tarefas a gerar
}

export interface ClientTaskGenerationTemplate {
  id: string;
  client_id: string;
  user_id: string;
  template_name: string;
  description?: string | null; // Adicionado
  delivery_count: number;
  generation_pattern: ClientTaskGenerationPattern[]; // JSONB
  is_active: boolean; // Novo campo
  default_due_days?: number | null; // Adicionado
  is_standard_task: boolean; // Novo campo
  created_at: string;
  updated_at: string;
}

export interface PublicApprovalLink {
  id: string;
  client_id: string;
  user_id: string;
  month_year_reference: string;
  unique_id: string;
  expires_at: string;
  created_at: string;
  client?: { // Adicionado para o join
    id: string;
    name: string;
    logo_url?: string | null;
  };
  client_tasks: ClientTask[]; // Adicionado para o join
}