"use client";

import React from 'react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';
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
import { Trash2 } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import * as z from "zod";

// Definindo o schema da pergunta
export const questionSchema = z.object({
  id: z.string().optional(), // ID para rastreamento interno (não DB)
  text: z.string().min(1, "O texto da pergunta é obrigatório."),
  type: z.enum(["text", "textarea", "select", "checkbox", "number", "date", "email", "phone", "url"]).default("text"),
  required: z.boolean().default(false),
  label: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export type QuestionFormValues = z.infer<typeof questionSchema>;

interface QuestionBuilderProps {
  form: UseFormReturn<any>;
  index: number;
  onRemove: (index: number) => void;
}

const QuestionBuilder: React.FC<QuestionBuilderProps> = ({ form, index, onRemove }) => {
  const questionType = form.watch(`form_structure.${index}.type`);

  return (
    <div className="p-3 border border-border rounded-lg space-y-3 bg-muted/20">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-foreground">Pergunta #{index + 1}</h4>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          className="text-red-500 hover:bg-red-500/10 h-8 w-8"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Remover Pergunta</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Tipo de Resposta */}
        <FormField
          control={form.control}
          name={`form_structure.${index}.type`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">Tipo de Resposta</FormLabel>
              <FormControl>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <SelectTrigger className="bg-input border-border text-foreground focus-visible:ring-ring h-9 text-sm">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
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
        
        {/* Campo de Pergunta */}
        <FormField
          control={form.control}
          name={`form_structure.${index}.text`}
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel className="text-xs text-muted-foreground">Pergunta</FormLabel>
              <FormControl>
                <Input
                  placeholder="Qual é a sua pergunta?"
                  className="bg-input border-border text-foreground focus-visible:ring-ring h-9 text-sm"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Campos Opcionais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField
          control={form.control}
          name={`form_structure.${index}.label`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">Rótulo do Campo (Opcional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Nome do Projeto"
                  className="bg-input border-border text-foreground focus-visible:ring-ring h-9 text-sm"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`form_structure.${index}.placeholder`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">Placeholder (Opcional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: Digite aqui..."
                  className="bg-input border-border text-foreground focus-visible:ring-ring h-9 text-sm"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`form_structure.${index}.required`}
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-2 shadow-sm bg-card h-9 mt-5">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                />
              </FormControl>
              <FormLabel className="text-foreground text-sm">Obrigatória</FormLabel>
            </FormItem>
          )}
        />
      </div>

      {/* Opções para Select */}
      {questionType === 'select' && (
        <FormField
          control={form.control}
          name={`form_structure.${index}.options`}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs text-muted-foreground">Opções (Separadas por vírgula)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Opção 1, Opção 2, Opção 3"
                  className="bg-input border-border text-foreground focus-visible:ring-ring h-9 text-sm"
                  value={field.value?.join(', ') || ''}
                  onChange={(e) => {
                    const optionsArray = e.target.value.split(',').map(o => o.trim()).filter(o => o.length > 0);
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
  );
};

export default QuestionBuilder;