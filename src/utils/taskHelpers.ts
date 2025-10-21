import { isToday, isThisWeek, isThisMonth } from "date-fns";
import { TaskRecurrenceType } from "@/types/task";

interface TaskForAdjustment {
  is_completed: boolean;
  recurrence_type: TaskRecurrenceType;
  last_successful_completion_date?: string | null;
}

/**
 * Retorna o status de conclusão ajustado para tarefas recorrentes.
 * Para tarefas não recorrentes, retorna o status original.
 * Para tarefas recorrentes, verifica se a última conclusão foi no período atual (dia, semana, mês).
 */
export const getAdjustedTaskCompletionStatus = (task: TaskForAdjustment): boolean => {
  if (task.recurrence_type === "none") {
    return task.is_completed;
  }

  if (!task.last_successful_completion_date) {
    return false; // Nunca concluída neste ciclo
  }

  const lastCompletionDate = new Date(task.last_successful_completion_date);
  const today = new Date();

  switch (task.recurrence_type) {
    case "daily":
      return isToday(lastCompletionDate);
    case "weekly":
      // Usando weekStartsOn: 0 (Domingo) para consistência com os padrões do date-fns
      return isThisWeek(lastCompletionDate, { weekStartsOn: 0 });
    case "monthly":
      return isThisMonth(lastCompletionDate);
    default:
      return task.is_completed; // Fallback, embora deva ser coberto
  }
};