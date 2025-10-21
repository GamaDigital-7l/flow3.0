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
import { format } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { ptBR } from "date-fns/locale/pt-BR";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

const healthMetricSchema = z.object({
  date: z.date().default(new Date()),
  weight_kg: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().min(0, "O peso deve ser um número positivo.").nullable().optional(),
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
    defaultValues: initialData ? {
      ...initialData,
      date: new Date(initialData.date),
    } : {
      date: new Date(),
      weight_kg: undefined,
      notes: "",
    },
  });

  const onSubmit = async (values: HealthMetricFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        date: format(values.date, "yyyy-MM-dd"),
        weight_kg: values.weight_kg || null,
        notes: values.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (initialData) {
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
      showError("Erro ao salvar métrica de saúde: " + error.message);
      console.error("Erro ao salvar métrica de saúde:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card">
      <div>
        <Label htmlFor="date" className="text-foreground">Data</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                !form.watch("date") && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
              {form.watch("date") ? (
                format(form.watch("date")!, "PPP", { locale: ptBR })
              ) : (
                <span>Escolha uma data</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
            <Calendar
              mode="single"
              selected={form.watch("date") || undefined}
              onSelect={(date) => form.setValue("date", date || new Date())}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div>
        <Label htmlFor="weight_kg" className="text-foreground">Peso (kg, opcional)</Label>
        <Input
          id="weight_kg"
          type="number"
          step="0.1"
          {...form.register("weight_kg", { valueAsNumber: true })}
          placeholder="Ex: 75.5"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.weight_kg && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.weight_kg.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="notes" className="text-foreground">Notas (Opcional)</Label>
        <Textarea
          id="notes"
          {...form.register("notes")}
          placeholder="Observações sobre sua saúde..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData ? "Atualizar Métrica" : "Adicionar Métrica"}
      </Button>
    </form>
  );
};

export default HealthMetricForm;