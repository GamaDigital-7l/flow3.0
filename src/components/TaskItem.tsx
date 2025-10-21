import React from "react";
import { Trash2, Repeat, Clock, Edit, PlusCircle, BookOpen, Dumbbell, GraduationCap, Loader2, AlertCircle, Users, CalendarDays } from "lucide-react";
import { format, isPast, isToday, isTomorrow, isThisWeek, isThisMonth, isSameDay, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Task, TaskCurrentBoard } from "@/types/task";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import TaskForm from "./TaskForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getAdjustedTaskCompletionStatus } from "@/utils/taskHelpers";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { formatDateTime, formatTime, parseISO } from "@/lib/utils"; // Importando parseISO de utils

interface TaskItemProps {
  task: Task;
  refetchTasks: () => void;
  isDailyRecurringView?: boolean; // Novo prop para a view de recorrentes diárias
}

const getTaskStatusBadge = (status: TaskCurrentBoard, task: Task) => {
// ... (rest of the function)
};

const getTaskDueDateDisplay = (task: Task): string => {
// ... (rest of the function)
};

const TaskItem: React.FC<TaskItemProps> = ({ task, refetchTasks, isDailyRecurringView = false }) => {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | undefined>(undefined);
  const [isSubtaskFormOpen, setIsSubtaskFormOpen] = React.useState(false); // Adicionado estado

  const isClientTaskMirrored = task.current_board === "client_tasks";
// ... (rest of the component)