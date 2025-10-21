import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, CalendarDays, Clock, MapPin, Link as LinkIcon } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Meeting } from "@/types/meeting";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import MeetingForm, { MeetingFormValues } from "./MeetingForm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { formatDateTime, formatTime } from "@/lib/utils"; // Importando as novas funções

interface MeetingItemProps {
  meeting: Meeting;
  refetchMeetings: () => void;
}

const MeetingItem: React.FC<MeetingItemProps> = ({ meeting, refetchMeetings }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingMeeting, setEditingMeeting] = React.useState<MeetingFormValues & { id: string } | undefined>(undefined);

  const handleDeleteMeeting = async (meetingId: string, googleEventId: string | null) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta reunião?")) {
      try {
        if (googleEventId && session?.access_token) {
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
          showSuccess("Evento removido do Google Calendar!");
        }

        const { error } = await supabase
          .from("meetings")
          .delete()
          .eq("id", meetingId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Reunião deletada com sucesso!");
        refetchMeetings();
        queryClient.invalidateQueries({ queryKey: ["futureMeetings", userId] });
        queryClient.invalidateQueries({ queryKey: ["googleEvents", userId] });
      } catch (err: any) {
        showError("Erro ao deletar reunião: " + err.message);
        console.error("Erro ao deletar reunião:", err);
      }
    }
  };

  const handleEditMeeting = (meetingToEdit: Meeting) => {
    setEditingMeeting({
      id: meetingToEdit.id,
      title: meetingToEdit.title,
      description: meetingToEdit.description || "",
      date: new Date(meetingToEdit.date),
      start_time: meetingToEdit.start_time,
      end_time: meetingToEdit.end_time || null,
      location: meetingToEdit.location || "",
      sendToGoogleCalendar: !!meetingToEdit.google_event_id,
      google_event_id: meetingToEdit.google_event_id,
      google_html_link: meetingToEdit.google_html_link,
    });
    setIsFormOpen(true);
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border">
      <div className="flex-grow min-w-0">
        <h3 className="font-semibold text-foreground text-base break-words">{meeting.title}</h3>
        {meeting.description && <p className="text-sm text-muted-foreground break-words">{meeting.description}</p>}
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CalendarDays className="h-3 w-3 flex-shrink-0" /> {formatDateTime(meeting.date, false)}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3 flex-shrink-0" /> {formatTime(meeting.start_time)} {meeting.end_time && `- ${formatTime(meeting.end_time)}`}
        </p>
        {meeting.location && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3 flex-shrink-0" /> {meeting.location}
          </p>
        )}
        {meeting.google_html_link && (
          <a href={meeting.google_html_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1">
            <LinkIcon className="h-3 w-3 flex-shrink-0" /> Ver no Google Calendar
          </a>
        )}
      </div>
      <div className="flex-shrink-0 flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => handleEditMeeting(meeting)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
          <Edit className="h-4 w-4" />
          <span className="sr-only">Editar Reunião</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => handleDeleteMeeting(meeting.id, meeting.google_event_id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Deletar Reunião</span>
        </Button>
      </div>

      {isFormOpen && (
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingMeeting(undefined);
          }}
        >
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Editar Reunião</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Atualize os detalhes da sua reunião.
              </DialogDescription>
            </DialogHeader>
            <MeetingForm
              initialData={editingMeeting}
              onMeetingSaved={refetchMeetings}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default MeetingItem;