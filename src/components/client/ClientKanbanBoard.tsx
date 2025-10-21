"use client";

import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';
import { Task } from '@/types/task';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DragDropContext, Droppable, Draggable } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, MoreVertical, CalendarDays, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSession } from '@/integrations/supabase/auth';
import { formatTime } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import TaskForm, { TaskFormValues } from '@/components/TaskForm';

interface ClientKanbanBoardProps {
  monthYearRef: string;
}

const fetchClientTasks = async (clientId: string, userId: string, monthYearRef: string): Promise<Task[]> => {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      last_successful_completion_date, origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, updated_at,
      task_tags(
        tags(id, name, color)
      )
    `)
    .eq("user_id", userId)
    .eq("client_name", clientId)
    .eq("month_year_reference", monthYearRef)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }
  const mappedData = data?.map((task: any) => ({
    ...task,
    tags: task.task_tags.map((tt: any) => tt.tags),
  })) || [];
  return mappedData;
};

const ClientKanbanBoard: React.FC<ClientKanbanBoardProps> = ({ monthYearRef }) => {
  const { clientId } = useParams<{ clientId: string }>();
  const { session } = useSession();
  const userId = session?.user?.id;
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  const { data: tasks, isLoading, error, refetch } = useQuery<Task[], Error>({
    queryKey: ["clientTasks", clientId, userId, monthYearRef],
    queryFn: () => fetchClientTasks(clientId!, userId!, monthYearRef),
    enabled: !!clientId && !!userId,
  });

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleTaskSaved = () => {
    refetch();
    setIsFormOpen(false);
    setEditingTask(undefined);
  };

  if (isLoading) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass">
        <CardHeader>
          <CardTitle>Kanban do Cliente</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full mt-2" />
          <Skeleton className="h-4 w-full mt-2" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    showError("Erro ao carregar tarefas do cliente: " + error.message);
    return <p>Erro ao carregar tarefas.</p>;
  }

  const tasksByStatus = useMemo(() => {
    const groupedTasks: { [key: string]: Task[] } = {};
    tasks?.forEach(task => {
      if (!groupedTasks[task.current_board]) {
        groupedTasks[task.current_board] = [];
      }
      groupedTasks[task.current_board].push(task);
    });
    return groupedTasks;
  }, [tasks]);

  const handleDragEnd = (result: any) => {
    // Implemente a lógica de arrastar e soltar aqui
  };

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        {Object.entries(tasksByStatus).map(([status, tasksForBoard]) => (
          <Card key={status} className="bg-card border border-border rounded-xl shadow-sm frosted-glass">
            <CardHeader className="p-3">
              <CardTitle className="text-lg font-semibold">{status}</CardTitle>
            </CardHeader>
            <CardContent className="p-3">
              {tasksForBoard.map((task, index) => (
                <Draggable key={task.id} draggableId={task.id} index={index}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="p-2 border border-border rounded-md mb-2 bg-muted/20"
                    >
                      <h4 className="text-sm font-medium text-foreground">{task.title}</h4>
                      {task.due_date && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" /> {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                      {task.time && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatTime(task.time)}
                        </p>
                      )}
                      <div className="flex items-center justify-end mt-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
                              <MoreVertical className="h-4 w-4" />
                              <span className="sr-only">Mais</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditTask(task)} className="cursor-pointer py-1.5 px-2">
                              <Edit className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            {/* Adicione outras opções aqui, como "Deletar" */}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )}
                </Draggable>
              ))}
            </CardContent>
          </Card>
        ))}
      </DragDropContext>

      {/* Modal de Edição de Tarefa */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle>Editar Tarefa</DialogTitle>
            <DialogDescription>
              Atualize os detalhes da sua tarefa.
            </DialogDescription>
          </DialogHeader>
          <TaskForm
            initialData={{ ...editingTask, due_date: editingTask?.due_date ? parseISO(editingTask.due_date) : undefined } as any} // FIX TS2322
            onTaskSaved={handleTaskSaved}
            onClose={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientKanbanBoard;