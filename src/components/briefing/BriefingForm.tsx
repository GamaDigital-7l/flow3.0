"use client";

import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
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
import { PlusCircle, Trash2 } from 'lucide-react';
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useNavigate } from 'react-router-dom'; // Usar useNavigate do react-router-dom
import { cn } from "@/lib/utils";

const questionTypes = [
  "text",
  "textarea",
  "select",
  "checkbox",
  "number",
  "date",
  "email",
  "phone",
  "url",
] as const;

const briefingSchema = z.object({
  title: z.string().min(1, "O título do briefing é obrigatório."),
  description: z.string().optional(),
  questions: z.array(
    z.object({
      text: z.string().min(1, "O texto da pergunta é obrigatório."),
      type: z.enum(questionTypes).default("text"),
      required: z.boolean().default(false),
      label: z.string().optional(),
      placeholder: z.string().optional(),
      options: z.array(z.string()).optional(),
    })
  ).optional(),
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
  const navigate = useNavigate(); // Usar useNavigate

  const form = useForm<BriefingFormValues>({
    resolver: zodResolver(briefingSchema),
    defaultValues: initialData || {
      title: "",
      description: "",
      questions: [],
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
        questions: values.questions || [],
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("briefings")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Briefing atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("briefings").insert({
          ...dataToSave,
          user_id: userId,
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

  const renderQuestionInput = (index: number, questionType: string) => {
    switch (questionType) {
      case "textarea":
        return (
          <FormField
            control={form.control}
            name={`questions.${index}.text`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder="Digite a pergunta"
                    className="bg-input border-border text-foreground focus-visible:ring-ring"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case "select":
        return (
          <FormField
            control={form.control}
            name={`questions.${index}.options`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="Opção 1, Opção 2, Opção 3"
                    className="bg-input border-border text-foreground focus-visible:ring-ring"
                    {...field}
                    value={field.value?.join(', ') || ''}
                    onChange={(e) => {
                      const optionsArray = e.target.value.split(',').map(o => o.trim());
                      field.onChange(optionsArray);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case "checkbox":
        return (
          <FormField
            control={form.control}
            name={`questions.${index}.text`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    placeholder="Digite a pergunta"
                    className="bg-input border-border text-foreground focus-visible:ring-ring"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case "number":
      case "date":
      case "email":
      case "phone":
      case "url":
      case "text":
      default:
        return (
          <FormField
            control={form.control}
            name={`questions.${index}.text`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    type={questionType === "number" ? "number" : questionType === "date" ? "date" : questionType === "email" ? "email" : questionType === "phone" ? "tel" : questionType === "url" ? "url" : "text"}
                    placeholder="Digite a pergunta"
                    className="bg-input border-border text-foreground focus-visible:ring-ring"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        );
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Perguntas</h3>
          {fields.map((item, index) => (
            <div key={item.id} className="p-3 border border-border rounded-md space-y-3">
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  className="text-red-500 hover:bg-red-500/10 h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">Remover Pergunta</span>
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name={`questions.${index}.type`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Resposta</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Texto Curto</SelectItem>
                            <SelectItem value="textarea">Texto Longo</SelectItem>
                            <SelectItem value="select">Múltipla Escolha</SelectItem>
                            <SelectItem value="checkbox">Checkbox</SelectItem>
                            <SelectItem value="number">Número</SelectItem>
                            <SelectItem value="date">Data</SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="phone">Telefone</SelectItem>
                            <SelectItem value="url">URL</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`questions.${index}.required`}
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-secondary/50">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                        />
                      </FormControl>
                      <FormLabel className="text-foreground">Obrigatória</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name={`questions.${index}.text`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pergunta</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Qual é a sua pergunta?"
                        className="bg-input border-border text-foreground focus-visible:ring-ring"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`questions.${index}.label`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor={`question-${index}-label`}>Rótulo do Campo (Opcional)</FormLabel>
                    <FormControl>
                      <Input
                        id={`question-${index}-label`}
                        placeholder="Ex: Nome do Projeto"
                        className="bg-input border-border text-foreground focus-visible:ring-ring"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`questions.${index}.placeholder`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel htmlFor={`question-${index}-placeholder`}>Placeholder (Opcional)</FormLabel>
                    <FormControl>
                      <Input
                        id={`question-${index}-placeholder`}
                        placeholder="Ex: Digite aqui..."
                        className="bg-input border-border text-foreground focus-visible:ring-ring"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {item.type === 'select' && (
                <FormField
                  control={form.control}
                  name={`questions.${index}.options`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor={`question-${index}-options`}>Opções (Separadas por vírgula)</FormLabel>
                      <FormControl>
                        <Input
                          id={`question-${index}-options`}
                          placeholder="Opção 1, Opção 2, Opção 3"
                          className="bg-input border-border text-foreground focus-visible:ring-ring"
                          value={field.value?.join(', ') || ''}
                          onChange={(e) => {
                            const optionsArray = e.target.value.split(',').map(o => o.trim());
                            field.onChange(optionsArray);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
          ))}
          <Button type="button" variant="outline" onClick={handleAddQuestion} className="w-full justify-start">
            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Pergunta
          </Button>
        </div>

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
          Salvar Briefing
        </Button>
      </form>
    </Form>
  );
};

export default BriefingForm;