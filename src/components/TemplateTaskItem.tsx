"use client";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Repeat, Edit, Trash2 } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Badge } from "@/components/ui/badge";
import { TemplateTask, DAYS_OF_WEEK_LABELS, TemplateFormOriginBoard } from "@/types/task";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import TemplateTaskForm from "@/components/TemplateTaskForm";
import { cn } from "@/lib/utils"; // Importar cn

interface TemplateTaskItemProps {
  templateTask: TemplateTask;
  refetchTemplateTasks: () => void;
}

const TemplateTaskItem: React.FC<TemplateTaskItemProps> = ({ templateTask, refetchTemplateTasks }) => {
  const { session } = useSession();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingTemplateTask, setEditingTemplateTask] = React.useState<TemplateTask | undefined>(undefined);

  const handleDeleteTemplateTask = useMutation({
    mutationFn: async (templateTaskId: string) => {
      if (!session?.user?.id) {
        showError("Usuário não autenticado.");
        return;
      }
      const { error } = await supabase
        .from("template_tasks")
        .delete()
        .eq("id", templateTaskId)
        .eq("user_id", session.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Tarefa padrão deletada com sucesso!");
      refetchTemplateTasks();
      queryClient.invalidateQueries({ queryKey: ["templateTasks"] });
    },
    onError: (err: any) => {
      showError("Erro ao deletar tarefa padrão: " + err.message);
      console.error("Erro ao deletar tarefa padrão:", err);
    },
  });

  const handleEditTemplateTask = (task: TemplateTask) => {
    setEditingTemplateTask(task);
    setIsFormOpen(true);
  };

  const getRecurrenceText = (task: TemplateTask) => {
    switch (task.recurrence_type) {
      case "daily":
        return "Diariamente";
      case "weekly":
        const days = task.recurrence_details?.split(',').map(day => DAYS_OF_WEEK_LABELS[day] || day).join(', ');
        return `Semanalmente nos dias: ${days}`;
      case "monthly":
        return `Mensalmente no dia ${task.recurrence_details}`;
      case "none":
      default:
        return "Nenhuma";
    }
  };

  const getOriginBoardText = (board: TemplateFormOriginBoard) => {
    switch (board) {
      case "general": return "Geral";
      case "today_priority": return "Hoje - Prioridade";
      case "today_no_priority": return "Hoje - Sem Prioridade";
      case "jobs_woe_today": return "Jobs Woe hoje";
      default: return board;
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 border border-border rounded-xl bg-background shadow-sm frosted-glass card-hover-effect">
      <div className="flex items-center gap-3 flex-grow min-w-0">
        <div className="grid gap-1.5 flex-grow min-w-0">
          <label className="text-sm font-medium leading-none text-foreground break-words">
            {templateTask.title}
          </label>
          {templateTask.description && (
            <p className="text-sm text-muted-foreground break-words">{templateTask.description}</p>
          )}
          <p className="text-xs text-muted-foreground flex items-center gap-1 break-words">
            <Repeat className="h-3 w-3 flex-shrink-0" /> Recorrência: {getRecurrenceText(templateTask)}
          </p>
          <p className="text-xs text-muted-foreground break-words">
            Quadro de Origem: {getOriginBoardText(templateTask.origin_board)}
          </p>
          {templateTask.tags && templateTask.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {templateTask.tags.map((tag) => (
                <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs flex-shrink-0">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 sm:mt-0 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => handleEditTemplateTask(templateTask)} className="text-muted-foreground hover:bg-accent hover:text-foreground">
          <Edit className="h-4 w-4" />
          <span className="sr-only">Editar Tarefa Padrão</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => handleDeleteTemplateTask.mutate(templateTask.id)} className="text-muted-foreground hover:bg-accent hover:text-foreground">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Deletar Tarefa Padrão</span>
        </Button>
      </div>

      {isFormOpen && (
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingTemplateTask(undefined);
          }}
        >
          <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingTemplateTask ? "Editar Tarefa Padrão" : "Adicionar Nova Tarefa Padrão"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingTemplateTask ? "Atualize os detalhes da sua tarefa padrão." : "Crie uma nova tarefa padrão para automatizar seu dia."}
              </DialogDescription>
            </DialogHeader>
            <TemplateTaskForm
              initialData={editingTemplateTask as any}
              onTemplateTaskSaved={refetchTemplateTasks}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default TemplateTaskItem;