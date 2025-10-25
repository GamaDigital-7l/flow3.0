// src/types/client.ts

export type ClientTaskStatus = "in_progress" | "under_review" | "approved" | "edit_requested" | "posted";

export interface Client {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  description: string | null;
  color: string;
  type: 'fixed' | 'hourly';
  monthly_delivery_goal: number;
  contact_email: string | null;
  contact_phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientTask {
  id: string;
  title: string;
  description: string | null;
  status: ClientTaskStatus;
  due_date: string | null;
  time: string | null;
  image_urls: string[] | null;
  public_approval_enabled: boolean;
  edit_reason: string | null;
  client_id: string;
  user_id: string;
  is_completed: boolean;
  order_index: number;
  public_approval_link_id: string | null;
  month_year_reference: string | null;
  tags?: { id: string; name: string; color: string }[];
}

export interface ClientTaskGenerationPattern {
  week: 1 | 2 | 3 | 4 | 5; // Semana do mês (1 a 5)
  day_of_week: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  count: number; // Quantas vezes gerar nesta semana/dia (geralmente 1)
}

export interface ClientTaskTemplate {
  id: string;
  user_id: string;
  client_id: string;
  template_name: string;
  description: string | null;
  delivery_count: number;
  generation_pattern: ClientTaskGenerationPattern[];
  is_active: boolean;
  default_due_days: number;
  is_standard_task: boolean;
  created_at: string;
  updated_at: string;
  
  // Relações
  client?: Client;
  client_task_tags: { tags: { id: string; name: string; color: string } }[];
}

export const DAYS_OF_WEEK_OPTIONS = [
  { value: 'Sunday', label: 'Domingo' },
  { value: 'Monday', label: 'Segunda-feira' },
  { value: 'Tuesday', label: 'Terça-feira' },
  { value: 'Wednesday', label: 'Quarta-feira' },
  { value: 'Thursday', label: 'Quinta-feira' },
  { value: 'Friday', label: 'Sexta-feira' },
  { value: 'Saturday', label: 'Sábado' },
];

export const WEEK_OPTIONS = [
  { value: 1, label: 'Primeira Semana' },
  { value: 2, label: 'Segunda Semana' },
  { value: 3, label: 'Terceira Semana' },
  { value: 4, label: 'Quarta Semana' },
  { value: 5, label: 'Última Semana' },
];