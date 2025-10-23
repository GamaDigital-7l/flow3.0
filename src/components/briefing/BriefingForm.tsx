"use client";

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { PlusCircle, Loader2 } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useNavigate } from 'react-router-dom';
import { cn } from "@/lib/utils";
import QuestionBuilder, { questionSchema } from './QuestionBuilder';

const briefingSchema = z.object({
  title: z.string().min(1, "O título do briefing é obrigatório."),
  description: z.string().optional().nullable(),
  form_structure: z.array(questionSchema).min(1, "O briefing deve ter pelo menos uma pergunta."),
  display_mode: z.enum(["all_questions", "one_by_one"]).default("all_questions"),
});

type BriefingFormValues = z.infer<typeof briefingSchema>;

interface BriefingFormProps {
  initialData?: Partial<BriefingFormValues> & { id: string };
  onBriefingSaved: () => void;
  onClose: () => void;
}

const BriefingForm: React.FC<BriefingFormProps> = ({ initialData, onBriefingSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const navigate = useNavigate();

  const form = useForm<BriefingFormValues>({
    resolver: zodResolver(briefingSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || null,
      form_structure: initialData?.form_structure && initialData.form_structure.length > 0 ? initialData.form_structure : [{ id: crypto.randomUUID(), text: "", type: "text", required: false, label: "", placeholder: "", options: [] }],
      display_mode: initialData?.display_mode || "all_questions",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "form_structure"
  });

  const handleAddQuestion = () => {
    append({ id: crypto.randomUUID(), text: "", type: "text", required: false, label: "", placeholder: "", options: [] });
  };

  const onSubmit = async (values: BriefingFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        title: values.title,
        description: values.description || null,
        form_structure: values.form_structure.map(q => ({
          ...q,
          // Garantir que o ID exista para cada pergunta
          id: q.id || crypto.randomUUID(),
          // Limpar opções se não for select
          options: q.type === 'select' ? q.options : null,
        })),
        display_mode: values.display_mode,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("briefing_forms")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("created_by", userId);

        if (error) throw error;
        showSuccess("Briefing atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("briefing_forms").insert({
          ...dataToSave,
          created_by: userId,
          workspace_id: null,
        });

        if (error) throw error;
        showSuccess("Briefing adicionado com sucesso!");
      }

      form.reset();
      onBriefingSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar briefing: " + error.message);
      console.error("Erro ao salvar briefing:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Informações Básicas */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Título do Briefing</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Briefing de Lançamento de Produto"
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
                  placeholder="Detalhes sobre este briefing..."
                  className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Modo de Exibição */}
        <FormField
          control={form.control}
          name="display_mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-foreground">Modo de Exibição</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
                    <SelectValue placeholder="Selecionar modo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
                  <SelectItem value="all_questions">Todas as perguntas de uma vez</SelectItem>
                  <SelectItem value="one_by_one">Uma pergunta por vez (Melhor para mobile)</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Construtor de Perguntas */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground border-t border-border pt-4">Perguntas ({fields.length})</h3>
          {fields.map((item, index) => (
            <QuestionBuilder
              key={item.id}
              form={form}
              index={index}
              onRemove={remove}
            />
          ))}
          <Button type="button" variant="outline" onClick={handleAddQuestion} className="w-full justify-start border-dashed border-primary text-primary hover:bg-primary/10">
            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Pergunta
          </Button>
          {form.formState.errors.form_structure && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.form_structure.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData?.id ? "Atualizar Briefing" : "Salvar Briefing")}
        </Button>
      </form>
    </Form>
  );
};

export default BriefingForm;