"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Repeat, Edit, Trash2, CalendarDays, CheckCircle2, Pause, Play, Zap } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import ClientTaskTemplateForm from './ClientTaskTemplateForm';
import { ClientTaskTemplate, DAYS_OF_WEEK_OPTIONS, WEEK_OPTIONS } from '@/types/client';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, addMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ClientTaskTemplatesProps {
  clientId: string;
  clientName: string;
}

const fetchClientTaskTemplates = async (clientId: string, userId: string): Promise<ClientTaskTemplate[]> => {
  const { data, error } = await supabase
    .from("client_task_generation_templates")
    .select(`
      *,
      client_template_tags(
        tags(id, name, color)
      )
    `)
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .order("template_name", { ascending: true });

  if (error) throw error;
  // Mapear as tags da nova tabela de junção
  const mappedData = data?.map((template: any) => ({
    ...template,
    client_task_tags: template.client_template_tags.map((ttt: any) => ({ tags: ttt.tags })),
  })) || [];
  
  return mappedData as ClientTaskTemplate[] || [];
};

const ClientTaskTemplates: React.FC<ClientTaskTemplatesProps> = ({ clientId, clientName }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ClientTaskTemplate | undefined>(undefined);
  const [selectedMonth, setSelectedMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM'));

  const { data: templates, isLoading, error, refetch } = useQuery<ClientTaskTemplate[], Error>({
    queryKey: ["clientTaskTemplates", clientId, userId],
    queryFn: () => fetchClientTaskTemplates(clientId, userId!),
    enabled: !!userId && !!clientId,
  });

  const handleTemplateSaved = () => {
    refetch();
    setIsFormOpen(false);
    setEditingTemplate(undefined);
  };

  const handleEditTemplate = (template: ClientTaskTemplate) => {
    setEditingTemplate(template);
    setIsFormOpen(true);
  };

  const handleDeleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      // Deletar tags associadas (usando a nova tabela client_template_tags)
      await supabase.from("client_template_tags").delete().eq("template_id", templateId);
      
      const { error } = await supabase
        .from("client_task_generation_templates")
        .delete()
        .eq("id", templateId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Template deletado com sucesso!");
      refetch();
    },
    onError: (err: any) => {
      showError("Erro ao deletar template: " + err.message);
    },
  });
  
  const handleToggleActive = useMutation({
    mutationFn: async (template: ClientTaskTemplate) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const newStatus = !template.is_active;
      
      const { error } = await supabase
        .from("client_task_generation_templates")
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq("id", template.id)
        .eq("user_id", userId);
      if (error) throw error;
      return newStatus;
    },
    onSuccess: (data, variables) => {
      showSuccess(`Template ${variables.is_active ? 'ativado' : 'pausado'} com sucesso!`);
      refetch();
    },
    onError: (err: any) => {
      showError("Erro ao atualizar status: " + err.message);
    },
  });
  
  const handleGenerateTasks = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      const { data, error } = await supabase.functions.invoke('generate-client-tasks', {
        body: {
          clientId: clientId,
          monthYearRef: selectedMonth,
          userId: userId,
        },
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      showSuccess("Tarefas geradas com sucesso! Atualize o Kanban para ver.");
      // Invalida a query do Kanban para forçar o recarregamento
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
    },
    onError: (err: any) => {
      showError("Erro ao gerar tarefas: " + err.message);
      console.error("Erro ao gerar tarefas:", err);
    },
  });

  const renderPattern = (pattern: ClientTaskTemplate['generation_pattern']) => {
    return pattern.map(p => {
      const weekLabel = WEEK_OPTIONS.find(w => w.value === p.week)?.label;
      const dayLabel = DAYS_OF_WEEK_OPTIONS.find(d => d.value === p.day_of_week)?.label;
      return `${p.count}x na ${weekLabel} (${dayLabel})`;
    }).join('; ');
  };
  
  const activeTemplates = templates?.filter(t => t.is_active) || [];
  const inactiveTemplates = templates?.filter(t => !t.is_active) || [];
  
  const generateMonthOptions = () => {
    const options = [];
    const today = startOfMonth(new Date());
    for (let i = -3; i <= 6; i++) { // 3 meses para trás e 6 meses para frente
      const date = addMonths(today, i);
      options.push(date);
    }
    return options;
  };

  if (isLoading) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm card-hover-effect">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Repeat className="h-4 w-4 text-status-recurring" /> Templates de Geração
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-muted-foreground text-sm">Carregando templates...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm card-hover-effect">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Repeat className="h-4 w-4 text-status-recurring" /> Templates de Geração
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-red-500 text-sm">Erro ao carregar templates: {error.message}</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Repeat className="h-7 w-7 text-status-recurring" /> Templates de Geração
        </h2>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTemplate(undefined)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Novo Template</DialogTitle>
              <DialogDescription>
                Crie um template para gerar tarefas recorrentes para o cliente {clientName}.
              </DialogDescription>
            </DialogHeader>
            <ClientTaskTemplateForm
              clientId={clientId}
              initialData={editingTemplate}
              onTemplateSaved={handleTemplateSaved}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Interface de Geração de Tarefas */}
      <Card className="bg-card border border-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" /> Gerar Tarefas Mensais
          </CardTitle>
          <CardDescription>
            Selecione o mês e gere todas as tarefas baseadas nos templates ativos.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Select
            value={selectedMonth}
            onValueChange={setSelectedMonth}
          >
            <SelectTrigger className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring h-10 text-sm">
              <CalendarDays className="mr-2 h-4 w-4 flex-shrink-0" />
              <SelectValue placeholder="Selecionar Mês" />
            </SelectTrigger>
            <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
              {generateMonthOptions().map((date) => {
                const value = format(date, "yyyy-MM");
                const label = format(date, "MMMM yyyy", { locale: ptBR }); 
                return <SelectItem key={value} value={value}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
          <Button 
            onClick={() => handleGenerateTasks.mutate()} 
            disabled={handleGenerateTasks.isPending || activeTemplates.length === 0}
            className="w-full sm:w-auto bg-green-600 text-white hover:bg-green-700 h-10 text-sm flex-shrink-0"
          >
            {handleGenerateTasks.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
            Gerar Tarefas
          </Button>
        </CardContent>
      </Card>

      {/* Templates Ativos */}
      <Card className="bg-card border border-border shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Ativos ({activeTemplates.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeTemplates.length > 0 ? (
            activeTemplates.map(template => (
              <div key={template.id} className="p-3 border border-border rounded-lg bg-muted/20 flex flex-col">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-foreground">{template.template_name}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEditTemplate(template)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleToggleActive.mutate(template)} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground">
                      {template.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Tem certeza que deseja deletar?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação irá deletar o template permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTemplate.mutate(template.id)}>Deletar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{template.description || 'Sem descrição.'}</p>
                
                <div className="flex flex-wrap gap-2 text-xs pt-1 border-t border-border/50">
                    <Badge variant="secondary" className="bg-primary/10 text-primary flex items-center gap-1">
                        <Repeat className="h-3 w-3" /> {renderPattern(template.generation_pattern)}
                    </Badge>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-500 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> {template.delivery_count} Entregas
                    </Badge>
                    {template.is_standard_task && (
                        <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 flex items-center gap-1">
                            Tarefa Principal
                        </Badge>
                    )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhum template ativo. Crie um novo para automatizar tarefas.</p>
          )}
        </CardContent>
      </Card>
      
      {/* Templates Inativos */}
      {inactiveTemplates.length > 0 && (
        <Card className="bg-card border-border shadow-lg opacity-70">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-muted-foreground">Inativos ({inactiveTemplates.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {inactiveTemplates.map(template => (
              <div key={template.id} className="p-3 border border-border rounded-lg bg-muted/20 flex justify-between items-center">
                <p className="font-semibold text-muted-foreground line-through">{template.template_name}</p>
                <Button variant="ghost" size="icon" onClick={() => handleToggleActive.mutate(template)} className="h-7 w-7 text-green-500 hover:bg-green-500/10">
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ClientTaskTemplates;