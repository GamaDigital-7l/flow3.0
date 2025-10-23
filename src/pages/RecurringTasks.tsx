import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskRecurrenceType } from "@/types/task";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Repeat, Loader2, PlusCircle, CalendarDays } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import TaskItem from "@/components/TaskItem";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { parseISO } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import RecurringTemplateItem from "@/components/recurring/RecurringTemplateItem"; // Importando o novo componente

const fetchRecurringTemplates = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, user_id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
      recurrence_time, last_moved_to_overdue_at, recurrence_streak,
      task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .neq("recurrence_type", "none") // Apenas templates
    .is("parent_task_id", null) // Garante que estamos pegando apenas templates raiz
    .order("title", { ascending: true });

  if (error) throw error;

  return data.map(task => ({
    ...task,
    tags: (task as any).task_tags.map((t: any) => t.tags),
    subtasks: [], 
    // due_date é mantido como string | null
  })) as Task[];
};

const RecurringTasks: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: templates, isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["recurringTemplates", userId],
    queryFn: () => fetchRecurringTemplates(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const handleTaskUpdated = () => {
    refetch();
    setIsFormOpen(false);
    setEditingTask(undefined);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando templates recorrentes...
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar templates recorrentes: " + error.message);
    return <p className="text-red-500">Erro ao carregar templates recorrentes: {error.message}</p>;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Repeat className="h-7 w-7 text-orange-500" /> Templates Recorrentes
        </h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTask(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Template
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingTask ? "Editar Template" : "Adicionar Novo Template Recorrente"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingTask ? "Atualize os detalhes do seu template." : "Defina uma tarefa que será instanciada automaticamente."}
              </DialogDescription>
            </DialogHeader>
            <TaskForm
              initialData={editingTask ? { 
                ...editingTask, 
                due_date: editingTask.due_date ? parseISO(editingTask.due_date) : undefined, // Converte string para Date aqui
                recurrence_type: editingTask.recurrence_type,
              } as any : {
                recurrence_type: 'daily',
                origin_board: 'recurring',
                current_board: 'recurring',
              }}
              onTaskSaved={handleTaskUpdated}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground mb-8">
        Estes são os modelos que geram tarefas automaticamente no quadro "Recorrentes" do seu Dashboard.
      </p>

      <Card className="mb-8 bg-card border-border shadow-lg frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Templates Ativos ({templates?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates && templates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(task => (
                <RecurringTemplateItem 
                  key={task.id} 
                  templateTask={task} 
                  refetchTemplates={refetch} 
                />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Nenhum template recorrente configurado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RecurringTasks;