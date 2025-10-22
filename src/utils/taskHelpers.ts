import { isToday, isThisWeek, isThisMonth } from "date-fns";
import { TaskRecurrenceType } from "@/types/task";

interface TaskForAdjustment {
  is_completed: boolean;
  recurrence_type: TaskRecurrenceType;
  last_successful_completion_date?: string | null;
}

/**
 * Retorna o status de conclusão ajustado para tarefas recorrentes.
 * Como agora usamos o modelo de instanciação, a verificação é direta.
 */
export const getAdjustedTaskCompletionStatus = (task: TaskForAdjustment): boolean => {
  // Com o novo modelo de instanciação, a Edge Function garante que a tarefa
  // do dia seja uma nova instância não concluída.
  return task.is_completed;
};