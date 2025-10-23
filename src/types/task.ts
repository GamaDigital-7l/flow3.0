export type TaskRecurrenceType = "none" | "daily" | "weekly" | "custom";
export type TaskOriginBoard = "general" | "today_high_priority" | "today_medium_priority" | "urgent" | "completed" | "overdue" | "week_low_priority" | "client_tasks";
export type TaskCurrentBoard = TaskOriginBoard;

export interface Tag {
  id: string;
  name: string;
  color: string;
}

// Task é agora o tipo principal, sem campos de recorrência complexos
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
  recurrence_streak?: number; // Mantido como opcional para compatibilidade de fetch
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