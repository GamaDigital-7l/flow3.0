import { isToday, isThisWeek, isThisMonth } from "date-fns";
// import { TaskRecurrenceType } from "@/types/task"; // REMOVIDO

interface TaskForAdjustment {
  is_completed: boolean;
  // recurrence_type: TaskRecurrenceType; // REMOVIDO
  last_successful_completion_date?: string | null;
}

/**
 * Retorna o status de conclusão ajustado.
 */
export const getAdjustedTaskCompletionStatus = (task: TaskForAdjustment): boolean => {
  // Como a recorrência foi removida, o status é direto.
  return task.is_completed;
};