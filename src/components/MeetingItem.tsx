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

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta reunião?")) {
      try {
        // Lógica de exclusão do Google Calendar removida

        const { error } = await supabase
          .from("meetings")
          .delete()
          .eq("id", meetingId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Reunião deletada com sucesso!");
        refetchMeetings();
        queryClient.invalidateQueries({ queryKey: ["futureMeetings", userId] });
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
      description: meetingToEdit.description || null,
      date: new Date(meetingToEdit.date),
      start_time: meetingToEdit.start_time,
      end_time: meetingToEdit.end_time || null,
      location: meetingToEdit.location || null,
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
        {/* Link do Google Calendar removido */}
      </div>
      <div className="flex-shrink-0 flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => handleEditMeeting(meeting)} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground">
          <Edit className="h-4 w-4" />
          <span className="sr-only">Editar Reunião</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={() => handleDeleteMeeting(meeting.id)} className="h-7 w-7 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
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