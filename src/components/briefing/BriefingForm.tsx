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
import QuestionBuilder, { questionSchema } from './QuestionBuilder'; // Importando QuestionBuilder e schema

const briefingSchema = z.object({
  title: z.string().min(1, "O título do briefing é obrigatório."),
  description: z.string().optional().nullable(),
  // Usando o schema de pergunta importado
  questions: z.array(questionSchema).optional(),
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
      questions: initialData?.questions || [],
      display_mode: initialData?.display_mode || "all_questions",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "questions"
  });

  const handleAddQuestion = () => {
    append({ text: "", type: "text", required: false, label: "", placeholder: "", options: [] });
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
        form_structure: values.questions || [], // Renomeado para form_structure no DB
        display_mode: values.display_mode,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("briefing_forms")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("created_by", userId); // Usando created_by como user_id

        if (error) throw error;
        showSuccess("Briefing atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("briefing_forms").insert({
          ...dataToSave,
          created_by: userId,
          workspace_id: null, // Assumindo workspace_id nulo por enquanto
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
        <div>
          <Label htmlFor="title" className="text-foreground">Título do Briefing</Label>
          <Input
            id="title"
            {...form.register("title")}
            placeholder="Ex: Briefing de Lançamento de Produto"
            className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
          />
          {form.formState.errors.title && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.title.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="description" className="text-foreground">Descrição (Opcional)</Label>
          <Textarea
            id="description"
            {...form.register("description")}
            placeholder="Detalhes sobre este briefing..."
            className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
          />
        </div>

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
        </div>

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
          {initialData?.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin hidden group-hover:inline" /> Atualizar Briefing</> : <><PlusCircle className="mr-2 h-4 w-4" /> Salvar Briefing</>}
        </Button>
      </form>
    </Form>
  );
};

export default BriefingForm;