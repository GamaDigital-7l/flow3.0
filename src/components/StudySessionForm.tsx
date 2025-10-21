import React from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { Checkbox } from "@/components/ui/checkbox";
import { ptBR } from "date-fns/locale/pt-BR";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante

const studySessionSchema = z.object({
  title: z.string().min(1, "O título da sessão de estudo é obrigatório."),
  duration_minutes: z.preprocess(
    (val) => (val === "" ? null : Number(val)),
    z.number().int().min(1, "A duração deve ser de pelo menos 1 minuto.").nullable().optional(),
  ),
  notes: z.string().optional(),
  session_date: z.date().default(new Date()),
  is_completed: z.boolean().default(false),
});

export type StudySessionFormValues = z.infer<typeof studySessionSchema>;

interface StudySessionFormProps {
  initialData?: StudySessionFormValues & { id: string };
  onSessionSaved: () => void;
  onClose: () => void;
}

const StudySessionForm: React.FC<StudySessionFormProps> = ({ initialData, onSessionSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const form = useForm<StudySessionFormValues>({
    resolver: zodResolver(studySessionSchema),
    defaultValues: initialData ? {
      ...initialData,
      session_date: new Date(initialData.session_date),
    } : {
      title: "",
      duration_minutes: undefined,
      notes: "",
      session_date: new Date(),
      is_completed: false,
    },
  });

  const onSubmit = async (values: StudySessionFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      const dataToSave = {
        title: values.title,
        duration_minutes: values.duration_minutes || null,
        notes: values.notes || null,
        session_date: format(values.session_date, "yyyy-MM-dd"),
        is_completed: values.is_completed,
        updated_at: new Date().toISOString(),
      };

      if (initialData) {
        const { error } = await supabase
          .from("study_sessions")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Sessão de estudo atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("study_sessions").insert({
          ...dataToSave,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Sessão de estudo adicionada com sucesso!");
      }
      form.reset();
      onSessionSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar sessão de estudo: " + error.message);
      console.error("Erro ao salvar sessão de estudo:", error);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
      <div>
        <Label htmlFor="title" className="text-foreground">Título da Sessão</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Revisar React Hooks"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.title && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="duration_minutes" className="text-foreground">Duração (minutos, opcional)</Label>
        <Input
          id="duration_minutes"
          type="number"
          {...form.register("duration_minutes", { valueAsNumber: true })}
          placeholder="Ex: 60"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
        {form.formState.errors.duration_minutes && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.duration_minutes.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="notes" className="text-foreground">Notas (Opcional)</Label>
        <Textarea
          id="notes"
          {...form.register("notes")}
          placeholder="O que você estudou ou aprendeu..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <div>
        <Label htmlFor="session_date" className="text-foreground">Data da Sessão</Label>
        <Popover>
          <PopoverTrigger asChild>
            <FormControl>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                  !form.watch("session_date") && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                {form.watch("session_date") ? (
                  format(form.watch("session_date")!, "PPP", { locale: ptBR })
                ) : (
                  <span>Escolha uma data</span>
                )}
              </Button>
            </FormControl>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
            <Calendar
              mode="single"
              selected={form.watch("session_date") || undefined}
              onSelect={(date) => form.setValue("session_date", date || new Date())}
              initialFocus
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_completed"
          checked={form.watch("is_completed")}
          onCheckedChange={(checked) => form.setValue("is_completed", checked as boolean)}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
        />
        <Label htmlFor="is_completed" className="text-foreground">Sessão Concluída</Label>
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {initialData ? "Atualizar Sessão" : "Adicionar Sessão"}
      </Button>
    </form>
  );
};

export default StudySessionForm;