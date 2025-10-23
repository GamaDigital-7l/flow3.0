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
import { format } from 'date-fns';
import { cn, convertToUtc, formatDateTime, parseISO } from '@/lib/utils';
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { ptBR } from "date-fns/locale/pt-BR";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormControl, Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const studySessionSchema = z.object({
  title: z.string().min(1, "O título da sessão é obrigatório."),
  duration_minutes: z.preprocess(
    (val) => (val === "" ? 0 : Number(val)),
    z.number().int().min(1, "A duração deve ser de pelo menos 1 minuto.")
  ),
  session_date: z.date({ required_error: "A data da sessão é obrigatória." }),
  notes: z.string().optional(),
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
  const queryClient = useQueryClient();

  const form = useForm<StudySessionFormValues>({
    resolver: zodResolver(studySessionSchema),
    defaultValues: {
      title: initialData?.title || "",
      duration_minutes: initialData?.duration_minutes || 30,
      session_date: initialData?.session_date ? new Date(initialData.session_date) : new Date(),
      notes: initialData?.notes || "",
    },
  });

  const saveSessionMutation = useMutation({
    mutationFn: async (values: StudySessionFormValues) => {
      if (!userId) throw new Error("Usuário não autenticado.");

      const dataToSave = {
        title: values.title,
        duration_minutes: values.duration_minutes,
        session_date: format(convertToUtc(values.session_date)!, "yyyy-MM-dd"),
        notes: values.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("study_sessions")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("study_sessions").insert({
          ...dataToSave,
          user_id: userId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      showSuccess(`Sessão de estudo ${initialData?.id ? 'atualizada' : 'adicionada'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["studySessions", userId] });
      onSessionSaved();
      onClose();
    },
    onError: (error: any) => {
      showError("Erro ao salvar sessão de estudo: " + error.message);
    },
  });

  const onSubmit = (values: StudySessionFormValues) => {
    saveSessionMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl card-hover-effect">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título da Sessão</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Revisão de React Query" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="duration_minutes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Duração (minutos)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    placeholder="30"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="session_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Data da Sessão</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                        {field.value ? formatDateTime(field.value, false) : <span>Selecione uma data</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
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
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas (Opcional)</FormLabel>
              <FormControl>
                <Textarea placeholder="O que você aprendeu ou revisou?" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={saveSessionMutation.isPending}>
          {saveSessionMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData ? "Atualizar Sessão" : "Adicionar Sessão")}
        </Button>
      </form>
    </Form>
  );
};

export default StudySessionForm;