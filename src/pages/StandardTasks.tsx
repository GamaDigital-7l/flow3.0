"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { TaskOriginBoard, DAYS_OF_WEEK_LABELS } from "@/types/task";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Repeat, Loader2, PlusCircle, Edit, Trash2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import StandardTaskForm, { StandardTaskFormValues } from "@/components/StandardTaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StandardTaskTemplate extends StandardTaskFormValues {
  id: string;
  user_id: string;
  is_active: boolean;
  created_at: string;
}

const fetchStandardTemplates = async (userId: string): Promise<StandardTaskTemplate[]> => {
  const { data, error } = await supabase
    .from("standard_task_templates")
    .select("*")
    .eq("user_id", userId)
    .order("title", { ascending: true });

  if (error) throw error;
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

const StandardTasks: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: templates, isLoading, error, refetch } = useQuery<StandardTaskTemplate[], Error>({
    queryKey: ["standardTemplates", userId],
    queryFn: () => fetchStandardTemplates(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<StandardTaskTemplate | undefined>(undefined);

  const handleTemplateUpdated = () => {
    refetch();
    setIsFormOpen(false);
    setEditingTemplate(undefined);
  };

  const handleEditTemplate = (template: StandardTaskTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const handleDeleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("standard_task_templates")
        .delete()
        .eq("id", templateId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Template de tarefa padrão deletado com sucesso!");
      refetch();
    },
    onError: (err: any) => {
      showError("Erro ao deletar template: " + err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando templates padrão...
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar templates padrão: " + error.message);
    return <p className="text-red-500">Erro ao carregar templates padrão.</p>;
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Repeat className="h-7 w-7 text-green-500" /> Tarefas Padrão
        </h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
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
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground mb-8">
        Gerencie tarefas que reaparecem automaticamente em dias fixos da semana, independentemente da conclusão.
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
    </div>
  );
};

export default StandardTasks;