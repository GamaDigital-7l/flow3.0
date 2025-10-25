"use client";

import React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { ClientTaskTemplate, DAYS_OF_WEEK_OPTIONS, WEEK_OPTIONS, ClientTaskGenerationPattern } from "@/types/client";
import TagSelector from "../TagSelector";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const tagSchema = z.object({
  name: z.string().min(1, "O nome da tag é obrigatório."),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Cor inválida. Use formato hexadecimal (ex: #RRGGBB).").default("#000000"),
});

export type TagFormValues = z.infer<typeof tagSchema>;

interface TagFormProps {
  initialData?: TagFormValues & { id: string };
  onTagSaved: () => void;
  onClose: () => void;
}

const patternSchema = z.object({
  week: z.preprocess(
    (val) => Number(val),
    z.number().int().min(1).max(5)
  ),
  day_of_week: z.enum(DAYS_OF_WEEK_OPTIONS.map(d => d.value) as [string, ...string[]]),
  count: z.preprocess(
    (val) => Number(val),
    z.number().int().min(1)
  ),
});

const templateSchema = z.object({
  template_name: z.string().min(1, "O nome do template é obrigatório."),
  description: z.string().nullable().optional(),
  delivery_count: z.preprocess(
    (val) => Number(val),
    z.number().int().min(1, "A contagem de entregas deve ser positiva.")
  ),
  default_due_days: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().min(0, "Dias de vencimento não pode ser negativo.").nullable(),
  ),
  is_active: z.boolean().default(true),
  is_standard_task: z.boolean().default(false),
  generation_pattern: z.array(patternSchema).min(1, "Pelo menos um padrão de geração é obrigatório."),
  selected_tag_ids: z.array(z.string()).optional(),
});

export type ClientTaskTemplateFormValues = z.infer<typeof templateSchema>;

interface ClientTaskTemplateFormProps {
  clientId: string;
  initialData?: ClientTaskTemplate;
  onTemplateSaved: () => void;
  onClose: () => void;
}

const ClientTaskTemplateForm: React.FC<ClientTaskTemplateFormProps> = ({ clientId, initialData, onTemplateSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<ClientTaskTemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      template_name: initialData?.template_name || "",
      description: initialData?.description || null,
      delivery_count: initialData?.delivery_count || 1,
      default_due_days: initialData?.default_due_days || 0,
      is_active: initialData?.is_active ?? true,
      is_standard_task: initialData?.is_standard_task ?? false,
      generation_pattern: initialData?.generation_pattern || [{ week: 1, day_of_week: 'Monday', count: 1 }],
      // Mapear tags da nova estrutura
      selected_tag_ids: initialData?.client_task_tags?.map(ttt => ttt.tags.id) || [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "generation_pattern",
  });
  
  const selectedTagIds = form.watch("selected_tag_ids") || [];

  const handleTagSelectionChange = (newSelectedTagIds: string[]) => {
    form.setValue("selected_tag_ids", newSelectedTagIds, { shouldDirty: true });
  };

  const saveTemplateMutation = useMutation({
    mutationFn: async (values: ClientTaskTemplateFormValues) => {
      if (!userId) throw new Error("Usuário não autenticado.");

      const dataToSave = {
        client_id: clientId,
        user_id: userId,
        template_name: values.template_name,
        description: values.description || null,
        delivery_count: values.delivery_count,
        generation_pattern: values.generation_pattern,
        is_active: values.is_active,
        default_due_days: values.default_due_days,
        is_standard_task: values.is_standard_task,
        updated_at: new Date().toISOString(),
      };

      let templateId: string;

      if (initialData?.id) {
        const { data, error } = await supabase
          .from("client_task_generation_templates")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId)
          .select("id")
          .single();

        if (error) throw error;
        templateId = data.id;
        showSuccess("Template atualizado com sucesso!");
      } else {
        const { data, error } = await supabase.from("client_task_generation_templates").insert(dataToSave).select("id").single();

        if (error) throw error;
        templateId = data.id;
        showSuccess("Template criado com sucesso!");
      }

      // Handle tags (using client_template_tags table)
      await supabase.from("client_template_tags").delete().eq("template_id", templateId);

      if (values.selected_tag_ids && values.selected_tag_ids.length > 0) {
        const templateTagsToInsert = values.selected_tag_ids.map(tagId => ({
          template_id: templateId, // Usando templateId aqui
          tag_id: tagId,
        }));
        const { error: tagInsertError } = await supabase.from("client_template_tags").insert(templateTagsToInsert);
        if (tagInsertError) throw tagInsertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientTaskTemplates", clientId, userId] });
      onTemplateSaved();
    },
    onError: (error: any) => {
      showError("Erro ao salvar template: " + error.message);
    },
  });

  const onSubmit = (values: ClientTaskTemplateFormValues) => {
    saveTemplateMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl card-hover-effect">
        
        {/* Informações Básicas */}
        <FormField
          control={form.control}
          name="template_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Template</FormLabel>
              <FormControl><Input placeholder="Ex: Post Semanal Instagram" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição da Tarefa (Opcional)</FormLabel>
              <FormControl><Textarea placeholder="Detalhes da tarefa gerada..." {...field} value={field.value || ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="delivery_count"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Contagem de Entregas (Unidade)</FormLabel>
                        <FormControl><Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl>
                        <FormDescription>Ex: 1 (para 1 post), 5 (para 5 stories).</FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="default_due_days"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Vencimento (Dias após Geração)</FormLabel>
                        <FormControl><Input type="number" min="0" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} /></FormControl>
                        <FormDescription>0 = Vence no dia da geração.</FormDescription>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        {/* Padrão de Geração */}
        <div className="space-y-4 border-t border-border pt-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Repeat className="h-4 w-4" /> Padrão de Recorrência Mensal
          </h3>
          
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-col sm:flex-row gap-2 p-3 bg-muted/20 rounded-lg border border-border items-end">
              <FormField
                control={form.control}
                name={`generation_pattern.${index}.week`}
                render={({ field: patternField }) => (
                  <FormItem className="flex-1 w-full">
                    <FormLabel className="text-xs">Semana</FormLabel>
                    <Select onValueChange={patternField.onChange} value={String(patternField.value)}>
                      <FormControl>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Semana" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {WEEK_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`generation_pattern.${index}.day_of_week`}
                render={({ field: patternField }) => (
                  <FormItem className="flex-1 w-full">
                    <FormLabel className="text-xs">Dia da Semana</FormLabel>
                    <Select onValueChange={patternField.onChange} value={patternField.value}>
                      <FormControl>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Dia" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DAYS_OF_WEEK_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`generation_pattern.${index}.count`}
                render={({ field: patternField }) => (
                  <FormItem className="w-16 flex-shrink-0">
                    <FormLabel className="text-xs">Qtd</FormLabel>
                    <FormControl><Input type="number" min="1" {...patternField} onChange={(e) => patternField.onChange(parseInt(e.target.value))} className="h-9 text-sm" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                className="h-9 w-9 text-red-500 hover:bg-red-500/10 flex-shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ week: 1, day_of_week: 'Monday', count: 1 })}
            className="w-full border-dashed border-border text-primary hover:bg-primary/10"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Padrão
          </Button>
        </div>

        {/* Tags */}
        <TagSelector
          selectedTagIds={selectedTagIds}
          onTagSelectionChange={handleTagSelectionChange}
        />
        
        {/* Configurações Adicionais */}
        <div className="space-y-4 border-t border-border pt-4">
            <FormField
                control={form.control}
                name="is_standard_task"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-secondary/50">
                        <FormControl>
                            <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>
                                Criar Tarefa Principal (Dashboard)
                            </FormLabel>
                            <FormDescription className="text-muted-foreground">
                                Se marcado, uma tarefa será criada no seu dashboard principal (board 'client_tasks') e vinculada a esta tarefa de cliente.
                            </FormDescription>
                        </div>
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-secondary/50">
                        <FormControl>
                            <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel>
                                Template Ativo
                            </FormLabel>
                            <FormDescription className="text-muted-foreground">
                                Desative para pausar a geração automática de tarefas.
                            </FormDescription>
                        </div>
                    </FormItem>
                )}
            />
        </div>

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={saveTemplateMutation.isPending}>
          {saveTemplateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData ? "Atualizar Template" : "Criar Template")}
        </Button>
      </form>
    </Form>
  );
};

export default ClientTaskTemplateForm;
```

```typescript
<dyad-write path="src/components/client/ClientKanbanBoard.tsx" description="Adding onImageClick prop to KanbanColumn component">
// src/components/client/ClientKanbanBoard.tsx
"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { DndContext, closestCorners, DragOverlay, useSensor, useSensors, MouseSensor, TouchSensor, DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Send, Copy, MessageSquare, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import ClientTaskCard from './ClientTaskCard';
import KanbanColumn from './ClientKanbanColumn';
import ClientMonthSelector from './ClientMonthSelector';
import { useClientKanban } from '@/hooks/useClientKanban';
import { ClientTaskStatus, ClientTask } from '@/types/client';
import { motion } from 'framer-motion';
import { Input } from "@/components/ui/input";
import { showSuccess } from '@/utils/toast';
import { cn } from '@/lib/utils';

interface ClientKanbanBoardProps {
  hook: ClientKanbanHook;
  onAddTask: (status: ClientTaskStatus) => void;
  onEditTask: (task: ClientTask) => void;
  refetchTasks: () => void;
  onImageClick: (url: string) => void;
}

const ClientKanbanBoard: React.FC<ClientKanbanBoardProps> = React.memo(({
  hook,
  onAddTask,
  onEditTask,
  refetchTasks,
  onImageClick,
}) => {
  const {
    tasksByStatus,
    isLoading,
    error,
    refetch,
    KANBAN_COLUMNS,
    activeDragItem,
    handleDragStart,
    handleDragEnd,
    handleGenerateApprovalLink,
    currentMonthYear,
  } = hook;

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const kanbanContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  // DND Sensors
  const mouseSensor = useSensor(MouseSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 5 } });
  const sensors = useSensors(mouseSensor, touchSensor);
  
  const tasksUnderReview = tasksByStatus.get('under_review') || [];

  const handleGenerateLinkClick = async () => {
    try {
      const link = await handleGenerateApprovalLink.mutateAsync();
      if (link) {
        setGeneratedLink(link);
        setIsLinkModalOpen(true);
      }
    } catch (e) {
      // Error handled in hook mutation onError
    }
  };
  
  const handleCopyLink = (link: string, message: boolean = false) => {
    if (message) {
      const whatsappMessage = `Olá! Segue o link para aprovação dos posts de ${currentMonthYear}: ${link}`;
      copy(whatsappMessage);
      showSuccess("Mensagem e link copiados para o WhatsApp!");
    } else {
      copy(link);
      showSuccess("Link copiado!");
    }
  };

  const handleScroll = () => {
    if (kanbanContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = kanbanContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth);
    }
  };

  useEffect(() => {
    handleScroll(); // Initial check
    const container = kanbanContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scroll = (scrollOffset: number) => {
    kanbanContainerRef.current?.scrollBy({ left: scrollOffset, behavior: 'smooth' });
  };

  return (
    <div className="flex-grow flex flex-col min-h-0">
      
      {/* Seletor de Mês */}
      <ClientMonthSelector currentMonthYear={currentMonthYear} onMonthChange={hook.setCurrentMonthYear} />
      
      {/* Botão de Link de Aprovação */}
      {tasksUnderReview.length > 0 && (
        <div className="mb-4 flex-shrink-0 mt-4">
          <Button 
            onClick={handleGenerateLinkClick} 
            disabled={handleGenerateApprovalLink.isPending || !tasksByStatus.get('under_review')?.filter(t => t.public_approval_enabled).length}
            className="w-full bg-primary text-white hover:bg-primary/90"
          >
            {handleGenerateApprovalLink.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Gerar Link de Aprovação ({tasksUnderReview.filter(t => t.public_approval_enabled).length} itens)
          </Button>
        </div>
      )}
      
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="p-4 text-red-500">Erro ao carregar tarefas.</div>
      ) : (
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* Container de Scroll Horizontal */}
          <div className="relative">
            {showLeftArrow && (
              <Button variant="ghost" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-card/80 text-muted-foreground hover:text-foreground hover:bg-accent" onClick={() => scroll(-200)}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
            )}
            {showRightArrow && (
              <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-10 w-10 rounded-full bg-card/80 text-muted-foreground hover:text-foreground hover:bg-accent" onClick={() => scroll(200)}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            )}
            <div
              ref={kanbanContainerRef}
              className="flex gap-4 pb-4 w-full flex-grow min-h-[50vh] overflow-x-auto scroll-smooth snap-mandatory snap-x"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {KANBAN_COLUMNS.map(column => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={tasksByStatus.get(column.id) || []}
                  onAddTask={onAddTask}
                  onEditTask={onEditTask}
                  refetchTasks={refetch}
                  onImageClick={onImageClick}
                />
              ))}
            </div>
          </div>
          
          <DragOverlay>
            {activeDragItem ? (
              <ClientTaskCard 
                task={activeDragItem as ClientTask} 
                onEdit={onEditTask} 
                refetchTasks={refetch}
                onImageClick={onImageClick}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modal de Link de Aprovação (mantido) */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Link de Aprovação Gerado</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Compartilhe este link com o cliente para aprovação dos posts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input value={generatedLink || ''} readOnly className="bg-input border-border text-foreground focus-visible:ring-ring" />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => handleCopyLink(generatedLink || '')} className="w-1/2 mr-2">
                <Copy className="mr-2 h-4 w-4" /> Copiar Link
              </Button>
              <Button onClick={() => handleCopyLink(generatedLink || '', true)} className="w-1/2 bg-green-500 text-white hover:bg-green-700">
                <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default ClientKanbanBoard;