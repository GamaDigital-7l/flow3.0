// src/types/habit.ts
export type HabitFrequency = "daily" | "weekly" | "custom";

export interface HabitMetrics {
  streak: number;
  total_completed: number;
  missed_days: string[]; // ISO Date strings (YYYY-MM-DD)
  fail_by_weekday: { [key: number]: number }; // 0=Sun, 6=Sat
  success_rate: number;
}

// Habit é a definição principal, representando a instância do dia ou a definição mais recente
export interface Habit {
  id: string; // ID da instância específica (date_local)
  recurrence_id: string; // ID compartilhado por todas as instâncias do mesmo hábito
  user_id: string;
  title: string;
  description: string | null;
  frequency: HabitFrequency;
  weekdays: number[] | null; // 0=Sun, 6=Sat
  paused: boolean;
  
  // Campos específicos da instância do dia
  completed_today: boolean;
  date_local: string; // YYYY-MM-DD (Data local desta instância)
  alert: boolean;
  
  // Métricas (herdadas/atualizadas da última instância)
  last_completed_date_local: string | null;
  streak: number;
  total_completed: number;
  missed_days: string[];
  fail_by_weekday: { [key: number]: number };
  success_rate: number;
  
  created_at: string;
  updated_at: string;
}

export interface HabitHistoryEntry {
  id: string;
  recurrence_id: string;
  user_id: string;
  date_local: string;
  completed: boolean;
  created_at: string;
}

export const WEEKDAY_LABELS: { [key: number]: string } = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};