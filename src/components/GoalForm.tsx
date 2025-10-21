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
import { ptBR } from "date-fns/locale/pt-BR";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante
import { formatDateTime, convertToSaoPauloTime, convertToUtc } from '@/lib/utils'; // Importando as novas funções

const goalSchema = z.object({
  title: z.string().min(1, "O título da meta é obrigatório."),
  description: z.string().optional(),
  target_date: z.date().optional().nullable(),
  status: z.enum(["pending", "in_progress", "completed"]).default("pending"),
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

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: initialData ? {
      ...initialData,
      target_date: new Date(initialData.target_date),
    } : {
      title: "",
      description: "",
      target_date: undefined,
      status: "pending",
    },
  });

  const onSubmit = async (values: GoalFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        title: values.title,
        description: values.description || null,
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
        showSuccess("Meta atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("goals").insert({
          title: values.title,
          description: values.description || null,
          target_date: values.target_date ? format(convertToUtc(values.target_date)!, "yyyy-MM-dd") : null,
          status: values.status,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Meta adicionada com sucesso!");
      }
      form.reset();
      onGoalSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar meta: " + error.message);
      console.error("Erro ao salvar meta:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
      <div>
        <Label htmlFor="title" className="text-foreground">Título da Meta</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Aprender um novo idioma"
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
          placeholder="Detalhes da meta..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <div>
        <Label htmlFor="target_date" className="text-foreground">Data Alvo (Opcional)</Label>
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
                  formatDateTime(form.watch("target_date"), false)
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
        <Label htmlFor="status" className="text-foreground">Status</Label>
        <Select
          onValueChange={(value: "pending" | "in_progress" | "completed") =>
            form.setValue("status", value)
          }
          value={form.watch("status")}
        >
          <SelectTrigger id="status" className="w-full bg-input border-border text-foreground focus-visible:ring-ring">
            <SelectValue placeholder="Selecionar status" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border rounded-md shadow-lg">
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="in_progress">Em Progresso</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData ? "Atualizar Meta" : "Adicionar Meta"}
      </Button>
    </form>
  );
};

export default GoalForm;