"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TaskFormValues } from "@/components/TaskForm";

const TaskBasicInfo: React.FC = () => {
  // Use useFormContext para acessar o contexto do formulário
  const form = useFormContext<TaskFormValues>();

  return (
    <>
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-foreground">Título</FormLabel>
            <FormControl>
              <Input
                placeholder="Ex: Terminar relatório"
                className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-foreground">Descrição (Opcional)</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Detalhes da tarefa..."
                className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                {...field}
                value={field.value || ''}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};

export default TaskBasicInfo;