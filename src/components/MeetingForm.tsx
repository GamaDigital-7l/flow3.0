"use client";

import React from "react";
import { useForm, UseFormReturn } from "react-hook-form"; // Importar UseFormReturn
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
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import TimePicker from "./TimePicker";
import { Meeting } from "@/types/meeting";
import { ptBR } from "date-fns/locale/pt-BR";
import { Checkbox } from "@/components/ui/checkbox"; 
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importar a constante
import { FormControl } from "@/components/ui/form"; // Importando FormControl

export const meetingSchema = z.object({ // Exportar o schema
  id: z.string().optional(), // Adicionar id
  title: z.string().min(1, "O título da reunião é obrigatório."),
  description: z.string().optional(),
  date: z.date().default(new Date()),
  start_time: z.string().min(1, "O horário de início é obrigatório."),
  end_time: z.string().optional().nullable(),
  location: z.string().optional(),
  sendToGoogleCalendar: z.boolean().default(false), 
  google_event_id: z.string().nullable().optional(), // Adicionar google_event_id
  google_html_link: z.string().nullable().optional(), // Adicionar google_html_link
});

export type MeetingFormValues = z.infer<typeof meetingSchema>;

interface MeetingFormProps {
  initialData?: MeetingFormValues & { id: string }; // Revertendo para aceitar initialData
  onMeetingSaved: () => void;
  onClose: () => void;
}

const MeetingForm: React.FC<MeetingFormProps> = ({ initialData, onMeetingSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: initialData ? {
      ...initialData,
      date: new Date(initialData.date),
    } : {
      title: "",
      description: "",
      date: new Date(),
      start_time: "",
      end_time: null,
      location: "",
      sendToGoogleCalendar: false,
      google_event_id: null,
      google_html_link: null,
    },
  });

  const onSubmit = async (values: MeetingFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    setIsSubmitting(true);

    try {
      let googleEventId: string | null = values.google_event_id || null;
      let googleHtmlLink: string | null = values.google_html_link || null;
      const currentMeetingId = values.id;

      const formattedDate = format(values.date, "yyyy-MM-dd");

      if (values.sendToGoogleCalendar) {
        if (!session?.access_token) {
          showError("Sessão não encontrada. Faça login novamente para interagir com o Google Calendar.");
          setIsSubmitting(false);
          return;
        }

        if (googleEventId) {
          const { data: googleData, error: googleError } = await supabase.functions.invoke('update-google-calendar-event', {
            body: {
              googleEventId: googleEventId,
              title: values.title,
              description: values.description,
              date: formattedDate,
              startTime: values.start_time,
              endTime: values.end_time,
              location: values.location,
            },
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          if (googleError) {
            throw new Error(googleError.message || "Erro ao atualizar evento no Google Calendar.");
          }
          googleEventId = googleData.googleEventId;
          googleHtmlLink = googleData.htmlLink;
          showSuccess("Evento atualizado no Google Calendar!");
        } else {
          const { data: googleData, error: googleError } = await supabase.functions.invoke('create-google-calendar-event', {
            body: {
              title: values.title,
              description: values.description,
              date: formattedDate,
              startTime: values.start_time,
              endTime: values.end_time,
              location: values.location,
            },
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          if (googleError) {
            throw new Error(googleError.message || "Erro ao criar evento no Google Calendar.");
          }
          googleEventId = googleData.googleEventId;
          googleHtmlLink = googleData.htmlLink;
          showSuccess("Evento criado no Google Calendar!");
        }
      } else if (googleEventId) {
        if (!session?.access_token) {
          showError("Sessão não encontrada. Faça login novamente para interagir com o Google Calendar.");
          setIsSubmitting(false);
          return;
        }
        const { error: googleDeleteError } = await supabase.functions.invoke('delete-google-calendar-event', {
          body: { googleEventId: googleEventId },
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (googleDeleteError) {
          if (googleDeleteError.status === 404) {
            console.warn(`Evento Google Calendar ${googleEventId} não encontrado, mas a exclusão foi solicitada. Prosseguindo com exclusão local.`);
          } else {
            throw new Error(googleDeleteError.message || "Erro ao deletar evento do Google Calendar.");
          }
        }
        googleEventId = null;
        googleHtmlLink = null;
        showSuccess("Evento removido do Google Calendar!");
      }

      const dataToSave = {
        title: values.title,
        description: values.description || null,
        date: formattedDate,
        start_time: values.start_time,
        end_time: values.end_time || null,
        location: values.location || null,
        google_event_id: googleEventId, 
        google_html_link: googleHtmlLink, 
        updated_at: new Date().toISOString(),
      };

      if (currentMeetingId) {
        const { error } = await supabase
          .from("meetings")
          .update(dataToSave)
          .eq("id", currentMeetingId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Reunião atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("meetings").insert({
          ...dataToSave,
          user_id: userId,
        });

        if (error) throw error;
        showSuccess("Reunião adicionada com sucesso!");
      }
      form.reset();
      onMeetingSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar reunião: " + error.message);
      console.error("Erro ao salvar reunião:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
      <div>
        <Label htmlFor="title" className="text-foreground">Título da Reunião</Label>
        <Input
          id="title"
          {...form.register("title")}
          placeholder="Ex: Reunião de equipe"
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
          placeholder="Detalhes da reunião..."
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <div>
        <Label htmlFor="date" className="text-foreground">Data da Reunião</Label>
        <Popover>
          <PopoverTrigger asChild>
            <FormControl>
              <Button
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                  !form.watch("date") && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                {form.watch("date") ? (
                  format(form.watch("date")!, "PPP") // FIX TS2554
                ) : (
                  <span>Escolha uma data</span>
                )}
              </Button>
            </FormControl>
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
        {form.formState.errors.date && (
          <p className="text-red-500 text-sm mt-1">
            {form.formState.errors.date.message}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> 
        <div>
          <Label htmlFor="start_time" className="text-foreground">Início</Label>
          <TimePicker
            value={form.watch("start_time") || null}
            onChange={(time) => form.setValue("start_time", time || "")}
          />
          {form.formState.errors.start_time && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.start_time.message}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="end_time" className="text-foreground">Fim (Opcional)</Label>
          <TimePicker
            value={form.watch("end_time") || null}
            onChange={(time) => form.setValue("end_time", time || null)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="location" className="text-foreground">Local (Opcional)</Label>
        <Input
          id="location"
          {...form.register("location")}
          placeholder="Ex: Sala de conferência A"
          className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="sendToGoogleCalendar"
          checked={form.watch("sendToGoogleCalendar")}
          onCheckedChange={(checked) => form.setValue("sendToGoogleCalendar", checked as boolean)}
          className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
        />
        <Label htmlFor="sendToGoogleCalendar" className="text-foreground">
          Enviar para Google Calendar
        </Label>
      </div>
      <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSubmitting}>
        {isSubmitting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          form.watch("id") ? "Atualizar Reunião" : "Adicionar Reunião"
        )}
      </Button>
    </form>
  );
};

export default MeetingForm;