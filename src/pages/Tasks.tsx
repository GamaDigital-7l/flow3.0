import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Task, TaskCurrentBoard, TaskOriginBoard, TaskRecurrenceType, DAYS_OF_WEEK_LABELS } from "@/types/task";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Filter, CalendarDays, Repeat, Edit, Trash2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import TaskItem from "@/components/TaskItem";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import TaskForm from "@/components/TaskForm";
import StandardTaskForm, { StandardTaskFormValues } from "@/components/StandardTaskForm"; // Importar StandardTaskForm
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { parseISO } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TASK_BOARDS: { id: TaskCurrentBoard; title: string }[] = [
  { id: "today_high_priority", title: "Hoje (Alta Prioridade)" },
  { id: "today_medium_priority", title: "Hoje (Média Prioridade)" },
  { id: "week_low_priority", title: "Esta Semana (Baixa Prioridade)" },
  { id: "general", title: "Geral" },
  { id: "recurring", title: "Recorrentes" },
  { id: "overdue", title: "Atrasadas" },
  { id: "client_tasks", title: "Tarefas de Cliente" },
  { id: "completed", title: "Concluídas" },
];

interface StandardTaskTemplate extends StandardTaskFormValues {
  id: string;
  user_id: string;
  is_active: boolean;
  created_at: string;
}

const fetchTasks = async (userId: string, board: TaskCurrentBoard): Promise<Task[]> => {
  let query = supabase
    .from("tasks")
    .select(`
      id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
      origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
      task_tags(
        tags(id, name, color)
      ),
      subtasks:tasks!parent_task_id(
        id, title, description, due_date, time, is_completed, recurrence_type, recurrence_details, 
        origin_board, current_board, is_priority, overdue, parent_task_id, client_name, created_at, completed_at, updated_at,
        task_tags(
          tags(id, name, color)
        )
      )
    `)
    .eq("user_id", userId)
    .eq("current_board", board)
    .is("parent_task_id", null);

  if (board === 'completed') {
    query = query.order("completed_at", { ascending: false });
  } else if (board === 'overdue') {
    query = query.order("due_date", { ascending: true });
  } else {
    query = query.order("is_priority", { ascending: false }).order("due_date", { ascending: true, nullsFirst: false });
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }
  const mappedData = data?.map((task: any) => ({
    ...task,
    tags: task.task_tags.map((tt: any) => tt.tags),
    subtasks: task.subtasks.map((sub: any) => ({
      ...sub,
      tags: sub.task_tags.map((t: any) => t.tags),
      template_task_id: null, // Temporariamente forçando null
    })),
    // Ensure date fields are Date objects if needed for form/display logic
    due_date: task.due_date ? parseISO(task.due_date) : null,
    template_task_id: null, // Forçando null
  })) || [];
  return mappedData;
};

const fetchStandardTemplates = async (userId: string): Promise<StandardTaskTemplate[]> => {
  // Usando o nome da tabela explícito 'public.standard_task_templates'
  const { data, error } = await supabase
    .from("public.standard_task_templates")
    .select("id, user_id, title, description, recurrence_days, origin_board, is_active, created_at")
    .eq("user_id", userId)
    .order("title", { ascending: true });

  if (error) {
    // Se o erro for o 404 de tabela não encontrada, ele será capturado aqui.
    console.error("Erro ao buscar templates padrão (fetchStandardTemplates):", error);
    throw error;
  }
  return data as StandardTaskTemplate[] || [];
};

const getBoardTitle = (boardId: TaskOriginBoard) => {
  switch (boardId) {
    case "today_high_priority": return "Hoje (Alta Prioridade)";
    case "today_medium_priority": return "Hoje (Média Prioridade)";
    case "week_low_priority": return "Esta Semana (Baixa Prioridade)";
    case "general": return "Geral";
    default: return boardId;
  }
};

const Tasks: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState<"tasks" | "templates">("tasks");
  const [activeBoard, setActiveBoard] = useState<TaskCurrentBoard>("today_high_priority");
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<StandardTaskTemplate | undefined>(undefined);


  const { data: tasks, isLoading: isLoadingTasks, error: errorTasks, refetch: refetchTasks } = useQuery<Task[], Error>({
    queryKey: ["tasks", userId, activeBoard],
    queryFn: () => fetchTasks(userId!, activeBoard),
    enabled: activeTab === "tasks" && !!userId,
  });

  const { data: templates, isLoading: isLoadingTemplates, error: errorTemplates, refetch: refetchTemplates } = useQuery<StandardTaskTemplate[], Error>({
    queryKey: ["standardTemplates", userId],
    queryFn: () => fetchStandardTemplates(userId!),
    enabled: activeTab === "templates" && !!userId,
  });

  const handleTaskUpdated = () => {
    refetchTasks();
    setIsTaskFormOpen(false);
    setEditingTask(undefined);
  };

  const handleTemplateUpdated = () => {
    refetchTemplates();
    setIsTemplateFormOpen(false);
    setEditingTemplate(undefined);
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleAddTask = () => {
    setEditingTask(undefined);
    setIsTaskFormOpen(true);
  };

  const handleEditTemplate = (template: StandardTaskTemplate) => {
    setEditingTemplate(template);
    setIsTemplateFormOpen(true);
  };

  const handleDeleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("public.standard_task_templates") // Usando nome explícito
        .delete()
        .eq("id", templateId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Template de tarefa padrão deletado com sucesso!");
      refetchTemplates();
    },
    onError: (err: any) => {
      showError("Erro ao deletar template: " + err.message);
    },
  });

  React.useEffect(() => {
    if (location.state?.openNewTaskForm) {
      handleAddTask();
    }
  }, [location.state?.openNewTaskForm]);

  if (isLoadingTasks && activeTab === "tasks") {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando tarefas...
      </div>
    );
  }
  
  if (isLoadingTemplates && activeTab === "templates") {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando templates padrão...
      </div>
    );
  }

  if (errorTasks && activeTab === "tasks") {
    showError("Erro ao carregar tarefas: " + errorTasks.message);
    return <p className="text-red-500">Erro ao carregar tarefas: {errorTasks.message}</p>;
  }
  
  if (errorTemplates && activeTab === "templates") {
    // Se o erro for o 404 de tabela não encontrada, exibimos uma mensagem específica
    if (errorTemplates.message.includes('Could not find the table')) {
        return (
            <div className="p-4 md:p-8">
                <h1 className="text-3xl font-bold text-foreground mb-6">Templates Padrão</h1>
                <p className="text-red-500">
                    Erro Crítico: A tabela 'standard_task_templates' não foi encontrada no esquema do banco de dados. 
                    Isso geralmente é um problema de cache persistente no Supabase. 
                    Por favor, tente recarregar a página ou, se o problema persistir, entre em contato com o suporte.
                </p>
            </div>
        );
    }
    showError("Erro ao carregar templates padrão: " + errorTemplates.message);
    return <p className="text-red-500">Erro ao carregar templates padrão: {errorTemplates.message}</p>;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <CalendarDays className="h-7 w-7 text-primary" /> Tarefas & Padrões
        </h1>
        
        {activeTab === "tasks" ? (
          <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddTask} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
                <DialogDescription>
                  {editingTask ? "Atualize os detalhes da sua tarefa." : "Defina uma nova tarefa para o seu dia."}
                </DialogDescription>
              </DialogHeader>
              <TaskForm
                  initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date || undefined } as any : undefined}
                  onTaskSaved={handleTaskUpdated}
                  onClose={() => setIsTaskFormOpen(false)}
                  initialOriginBoard={activeBoard}
              />
            </DialogContent>
          </Dialog>
        ) : (
          <Dialog open={isTemplateFormOpen} onOpenChange={setIsTemplateFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingTemplate(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Template
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">{editingTemplate ? "Editar Template Padrão" : "Adicionar Novo Template Padrão"}</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {editingTemplate ? "Atualize os detalhes do seu template." : "Crie tarefas que reaparecem em dias específicos da semana."}
                </DialogDescription>
              </DialogHeader>
              <StandardTaskForm
                initialData={editingTemplate}
                onTemplateSaved={handleTemplateUpdated}
                onClose={() => setIsTemplateFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "tasks" | "templates")} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted text-muted-foreground">
          <TabsTrigger value="tasks">Minhas Tarefas</TabsTrigger>
          <TabsTrigger value="templates">Templates Padrão</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tasks" className="mt-4">
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              {TASK_BOARDS.map(board => (
                <Button
                  key={board.id}
                  variant={activeBoard === board.id ? "default" : "outline"}
                  onClick={() => setActiveBoard(board.id)}
                  className="flex-shrink-0"
                >
                  {board.title} ({tasks?.length || 0})
                </Button>
              ))}
            </div>
          </div>

          <Card className="bg-card border-border shadow-lg frosted-glass">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground">{getBoardTitle(activeBoard)}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tasks && tasks.length > 0 ? (
                tasks.map(task => (
                  <TaskItem key={task.id} task={task} refetchTasks={refetchTasks} />
                ))
              ) : (
                <p className="text-muted-foreground">Nenhuma tarefa encontrada nesta categoria.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="templates" className="mt-4">
          <p className="text-muted-foreground mb-4">
            Gerencie tarefas que reaparecem automaticamente em dias fixos da semana, se não estiverem pendentes.
          </p>
          <Card className="mb-8 bg-card border-border shadow-lg frosted-glass card-hover-effect">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground">Templates Ativos ({templates?.length || 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates && templates.length > 0 ? (
                templates.map(template => (
                  <div key={template.id} className="p-3 border border-border rounded-lg bg-muted/20 space-y-1 flex justify-between items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground truncate">{template.title}</p>
                      <p className="text-sm text-muted-foreground">Quadro: {getBoardTitle(template.origin_board as TaskOriginBoard)}</p>
                      <p className="text-xs text-muted-foreground">Dias: {template.recurrence_days.split(',').map(day => DAYS_OF_WEEK_LABELS[day.trim()] || day).join(', ')}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(template)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplate.mutate(template.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">Nenhum template padrão configurado.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para edição de Tarefa Comum */}
      <Dialog open={isTaskFormOpen} onOpenChange={setIsTaskFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingTask ? "Editar Tarefa" : "Adicionar Nova Tarefa"}</DialogTitle>
            <DialogDescription>
              {editingTask ? "Atualize os detalhes da sua tarefa." : "Defina uma nova tarefa para o seu dia."}
            </DialogDescription>
          </DialogHeader>
          <TaskForm
              initialData={editingTask ? { ...editingTask, due_date: editingTask.due_date || undefined } as any : undefined}
              onTaskSaved={handleTaskUpdated}
              onClose={() => setIsTaskFormOpen(false)}
              initialOriginBoard={activeBoard}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog para edição de Template Padrão */}
      <Dialog open={isTemplateFormOpen} onOpenChange={setIsTemplateFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingTemplate ? "Editar Template Padrão" : "Adicionar Novo Template Padrão"}</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingTemplate ? "Atualize os detalhes do seu template." : "Crie tarefas que reaparecem em dias específicos da semana."}
            </DialogDescription>
          </DialogHeader>
          <StandardTaskForm
            initialData={editingTemplate}
            onTemplateSaved={handleTemplateUpdated}
            onClose={() => setIsTemplateFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tasks;