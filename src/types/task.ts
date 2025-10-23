export type TaskRecurrenceType = "none" | "daily" | "weekly" | "custom";
export type TaskOriginBoard = "general" | "today_high_priority" | "today_medium_priority" | "urgent" | "completed" | "overdue" | "week_low_priority" | "client_tasks" | "recurring";
export type TaskCurrentBoard = TaskOriginBoard;

export interface Tag {
  id: string;
  name: string;
  color: string;
}

// Interface para a Tabela Recurring_Tasks (que armazena templates e instâncias)
export interface RecurringTask {
  id: string;
  recurrence_id: string; // ID do template (igual ao ID se for o template)
  user_id: string;
  title: string;
  description: string | null;
  frequency: TaskRecurrenceType;
  weekdays: number[] | null; // 0=Dom, 6=Sáb
  paused: boolean;
  completed_today: boolean;
  date_local: string; // YYYY-MM-DD (data local do usuário)
  last_completed_date_local: string | null;
  streak: number;
  total_completed: number;
  missed_days: string[]; // Array de YYYY-MM-DD
  fail_by_weekday: { [key: number]: number }; // {0: 0, 1: 5, ...}
  success_rate: number;
  alert: boolean;
  created_at: string;
  updated_at: string;
  
  // Campos de Task (mantidos para compatibilidade com TaskItem, mas serão null/default)
  due_date: string | null; 
  time: string | null; 
  is_completed: boolean; // Usaremos completed_today para o status do dia
  recurrence_type: TaskRecurrenceType; // Mantido para compatibilidade
  recurrence_details: string | null; 
  recurrence_time: string | null; 
  origin_board: TaskOriginBoard;
  current_board: TaskCurrentBoard;
  is_priority: boolean;
  overdue: boolean;
  completed_at: string | null;
  last_moved_to_overdue_at: string | null;
  parent_task_id: string | null;
  client_name: string | null;
  tags: Tag[];
  subtasks?: Task[]; 
}

// Task é agora uma união de tipos para compatibilidade
export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string | null; // ISO Date string
  time: string | null; // Time string (HH:MM:SS)
  is_completed: boolean;
  recurrence_type: TaskRecurrenceType; 
  recurrence_details: string | null; 
  recurrence_time: string | null; 
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
  
  subtasks?: Task[]; 
  recurrence_streak?: number; 
}

export interface RecurringHistory {
  id: string;
  recurrence_id: string;
  user_id: string;
  date_local: string;
  completed: boolean;
  created_at: string;
}

export const DAYS_OF_WEEK_MAP: { [key: string]: number } = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export const DAYS_OF_WEEK_LABELS: { [key: number]: string } = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};