import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn, formatDateTime, convertToUtc } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { ptBR } from "date-fns/locale/pt-BR";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormControl, Form } from "@/components/ui/form"; // Added FormControl and Form
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Added Select components

const goalSchema = z.object({
  title: z.string().min(1, "O título da meta é obrigatório."),
  description: z.string().optional(),
  target_value: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0.01, "O valor alvo deve ser positivo.")
  ),
  current_value: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().min(0, "O valor atual não pode ser negativo.")
  ),
  unit: z.string().min(1, "A unidade é obrigatória."),
  target_date: z.date().nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'archived']).default('pending'),
});

export type GoalFormValues = z.infer<typeof goalSchema>;

interface GoalFormProps {
  initialData?: GoalFormValues & { id: string };
  onGoalSaved: () => void;
  onClose: () => void;
}

const GoalForm: React.FC<GoalFormProps> = ({ initialData, onGoalSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || "",
      target_value: initialData?.target_value || 0,
      current_value: initialData?.current_value || 0,
      unit: initialData?.unit || "",
      target_date: initialData?.target_date || undefined,
      status: initialData?.status || 'pending',
    },
  });

  const saveGoalMutation = useMutation({
    mutationFn: async (values: GoalFormValues) => {
      if (!userId) throw new Error("Usuário não autenticado.");

      const dataToSave = {
        title: values.title,
        description: values.description || null,
        target_value: values.target_value,
        current_value: values.current_value,
        unit: values.unit,
        target_date: values.target_date ? format(convertToUtc(values.target_date)!, "yyyy-MM-dd") : null,
        status: values.status,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("goals")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("goals").insert({
          ...dataToSave,
          user_id: userId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showSuccess(`Meta ${initialData?.id ? 'atualizada' : 'adicionada'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["goals", userId] });
      queryClient.invalidateQueries({ queryKey: ["activeGoalsForResults", userId] });
      onGoalSaved();
    },
    onError: (error: any) => {
      showError("Erro ao salvar meta: " + error.message);
    },
  });

  const onSubmit = (values: GoalFormValues) => {
    saveGoalMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl card-hover-effect">
        <div>
          <Label htmlFor="title">Título da Meta</Label>
          <Input id="title" {...form.register("title")} placeholder="Ex: Aprender React" />
          {form.formState.errors.title && <p className="text-red-500 text-sm mt-1">{form.formState.errors.title.message}</p>}
        </div>
        <div>
          <Label htmlFor="description">Descrição (Opcional)</Label>
          <Textarea id="description" {...form.register("description")} placeholder="Detalhes da meta..." />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="target_value">Valor Alvo</Label>
            <Input
              id="target_value"
              type="number"
              step="0.01"
              {...form.register("target_value", { valueAsNumber: true })}
              placeholder="100"
            />
            {form.formState.errors.target_value && <p className="text-red-500 text-sm mt-1">{form.formState.errors.target_value.message}</p>}
          </div>
          <div>
            <Label htmlFor="current_value">Valor Atual</Label>
            <Input
              id="current_value"
              type="number"
              step="0.01"
              {...form.register("current_value", { valueAsNumber: true })}
              placeholder="0"
            />
            {form.formState.errors.current_value && <p className="text-red-500 text-sm mt-1">{form.formState.errors.current_value.message}</p>}
          </div>
          <div>
            <Label htmlFor="unit">Unidade</Label>
            <Input id="unit" {...form.register("unit")} placeholder="Ex: horas, livros, kg" />
            {form.formState.errors.unit && <p className="text-red-500 text-sm mt-1">{form.formState.errors.unit.message}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="target_date">Data Alvo (Opcional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                      !form.watch("target_date") && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    {form.watch("target_date") ? (
                      formatDateTime(form.watch("target_date")!, false)
                    ) : (
                      <span>Escolha uma data</span>
                    )}
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
                <Calendar
                  mode="single"
                  selected={form.watch("target_date") || undefined}
                  onSelect={(date) => form.setValue("target_date", date || null)}
                  initialFocus
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              onValueChange={(value: 'pending' | 'in_progress' | 'completed' | 'archived') => form.setValue("status", value)}
              value={form.watch("status")}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Selecionar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="in_progress">Em Progresso</SelectItem>
                <SelectItem value="completed">Concluída</SelectItem>
                <SelectItem value="archived">Arquivada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={saveGoalMutation.isPending}>
          {saveGoalMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData ? "Atualizar Meta" : "Adicionar Meta")}
        </Button>
      </form>
    </Form>
  );
};

export default GoalForm;