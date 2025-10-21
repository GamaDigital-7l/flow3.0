"use client";

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
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn, convertToUtc } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { ptBR } from "date-fns/locale/pt-BR";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { FormControl, Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const healthMetricSchema = z.object({
  date: z.date({ required_error: "A data é obrigatória." }),
  weight_kg: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().min(0, "O peso deve ser positivo.").nullable().optional(),
  ),
  notes: z.string().optional(),
});

export type HealthMetricFormValues = z.infer<typeof healthMetricSchema>;

interface HealthMetricFormProps {
  initialData?: HealthMetricFormValues & { id: string };
  onMetricSaved: () => void;
  onClose: () => void;
}

const HealthMetricForm: React.FC<HealthMetricFormProps> = ({ initialData, onMetricSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<HealthMetricFormValues>({
    resolver: zodResolver(healthMetricSchema),
    defaultValues: {
      date: initialData?.date ? new Date(initialData.date) : new Date(),
      weight_kg: initialData?.weight_kg || undefined,
      notes: initialData?.notes || undefined,
    },
  });

  const onSubmit = async (values: HealthMetricFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        date: format(convertToUtc(values.date)!, "yyyy-MM-dd"),
        weight_kg: values.weight_kg || null,
        notes: values.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("health_metrics")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Métrica de saúde atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("health_metrics").insert({
          ...dataToSave,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Métrica de saúde adicionada com sucesso!");
      }
      form.reset();
      onMetricSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar métrica: " + error.message);
      console.error("Erro ao salvar métrica:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data da Medição</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                      {field.value ? (
                        format(field.value, "PPP") // FIX TS2554
                      ) : (
                        <span>Escolha uma data</span>
                      )}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="weight_kg"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Peso (kg, Opcional)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="Ex: 75.5"
                  className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  value={field.value === null || field.value === undefined ? '' : field.value}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas (Opcional)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Observações sobre a medição..."
                  className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
          {initialData ? "Atualizar Métrica" : "Adicionar Métrica"}
        </Button>
      </form>
    </Form>
  );
};

export default HealthMetricForm;