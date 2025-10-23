export type TaskRecurrenceType = "none"; // Mantido 'none' como único valor
export type TaskOriginBoard = "general" | "today_high_priority" | "today_medium_priority" | "urgent" | "completed" | "overdue" | "week_low_priority" | "client_tasks";
export type TaskCurrentBoard = TaskOriginBoard;

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null; // ISO Date string
  time: string | null; // Time string (HH:MM:SS)
  is_completed: boolean;
  recurrence_type: TaskRecurrenceType; // Tipo de recorrência (agora sempre 'none')
  recurrence_details: string | null; // Removido, mas mantido como null para compatibilidade de DB
  recurrence_time: string | null; // Removido, mas mantido como null para compatibilidade de DB
  origin_board: TaskOriginBoard;
  current_board: TaskCurrentBoard;
  is_priority: boolean;
  overdue: boolean;
  completed_at: string | null;
  last_moved_to_overdue_at: string | null;
  parent_task_id: string | null;
  client_name: string | null;
  tags: Tag[];
  created_at: string;
  updated_at: string;
  
  subtasks?: Task[]; // Adicionado para a árvore de tarefas
  recurrence_streak?: number; // Mantido opcionalmente para evitar erros de tipagem em fetches antigos
}

export type TemplateFormOriginBoard = "general" | "today_priority" | "today_no_priority" | "jobs_woe_today"; // Mantido para compatibilidade com outros forms, mas deve ser removido se não for usado

// Removendo TemplateTask

export const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export const DAYS_OF_WEEK_LABELS: { [key: string]: string } = {
  Sunday: "Dom",
  Monday: "Seg",
  Tuesday: "Ter",
  Wednesday: "Qua",
  Thursday: "Qui",
  Friday: "Sex",
  Saturday: "Sáb",
};