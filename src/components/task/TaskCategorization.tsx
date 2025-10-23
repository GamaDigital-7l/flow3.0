"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import TagSelector from "@/components/TagSelector";
import { TaskFormValues } from "@/components/TaskForm";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";

interface TaskCategorizationProps {
  form: UseFormReturn<TaskFormValues>;
}

const fetchClients = async (userId: string) => {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
};

const TaskCategorization: React.FC<TaskCategorizationProps> = ({ form }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const selectedTagIds = form.watch("selected_tag_ids") || [];

  const { data: clients, isLoading: isLoadingClients } = useQuery({
    queryKey: ["clientsList", userId],
    queryFn: () => fetchClients(userId!),
    enabled: !!userId,
  });

  const handleTagSelectionChange = (newSelectedTagIds: string[]) => {
    form.setValue("selected_tag_ids", newSelectedTagIds, { shouldDirty: true });
  };

  return (
    <>
      <FormField
        control={form.control}
        name="origin_board"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-foreground">Quadro de Origem</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                  <SelectValue placeholder="Selecionar quadro" />
                </SelectTrigger>
              </FormControl>
              <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                <SelectItem value="general">Geral</SelectItem>
                <SelectItem value="today_high_priority">Hoje - Prioridade Alta</SelectItem>
                <SelectItem value="today_medium_priority">Hoje - Prioridade Média</SelectItem>
                <SelectItem value="week_low_priority">Semana - Baixa</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="is_priority"
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
              <FormLabel className="text-foreground">
                Prioridade Alta (Aparece no quadro "Hoje - Prioridade Alta")
              </FormLabel>
              <FormDescription className="text-muted-foreground">
                Marque se esta tarefa for crucial para o dia.
              </FormDescription>
            </div>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="client_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-foreground">Cliente (Opcional)</FormLabel>
            <Select onValueChange={(value) => field.onChange(value === '__none__' ? null : value)} value={field.value || '__none__'} disabled={isLoadingClients}>
              <FormControl>
                <SelectTrigger className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                  {isLoadingClients ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" /> Carregando clientes...
                    </div>
                  ) : (
                    <SelectValue placeholder="Selecionar cliente" />
                  )}
                </SelectTrigger>
              </FormControl>
              <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                <SelectItem value="__none__">Nenhum</SelectItem>
                {clients?.map(client => (
                  <SelectItem key={client.id} value={client.name}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <TagSelector
        selectedTagIds={selectedTagIds}
        onTagSelectionChange={handleTagSelectionChange}
      />
    </>
  );
};

export default TaskCategorization;