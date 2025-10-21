import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { isToday } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, BookOpen, Dumbbell, GraduationCap, Loader2, AlertCircle, Repeat } from "lucide-react";
import { showError } from "@/utils/toast";
import { format, differenceInDays } from "date-fns";
import { parseISO } from "date-fns/parseISO";
import { ptBR } from "date-fns/locale/pt-BR";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils"; // Importando as novas funções

interface StudySession extends Omit<StudySessionFormValues, 'session_date'> {
  id: string;
  created_at: string;
  updated_at: string;
  session_date: string;
}

const fetchStudySessions = async (userId: string): Promise<StudySession[]> => {
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
};

const Study: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: studySessions, isLoading, error, refetch } = useQuery<StudySession[], Error>({
    queryKey: ["studySessions", userId],
    queryFn: () => fetchStudySessions(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingSession, setEditingSession] = React.useState<StudySession | undefined>(undefined);

  const handleEditSession = (session: StudySession) => {
    setEditingSession(session);
    setIsFormOpen(true);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta sessão de estudo?")) {
      try {
        const { error } = await supabase
          .from("study_sessions")
          .delete()
          .eq("id", sessionId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Sessão de estudo deletada com sucesso!");
        refetch();
      } catch (err: any) {
        showError("Erro ao deletar sessão de estudo: " + err.message);
        console.error("Erro ao deletar sessão de estudo:", err);
      }
    }
  };

  const handleToggleComplete = async (sessionId: string, currentStatus: boolean) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    try {
      const { error } = await supabase
        .from("study_sessions")
        .update({ is_completed: !currentStatus, updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("user_id", userId);

      if (error) throw error;
      showSuccess("Status da sessão de estudo atualizado!");
      refetch();
    } catch (err: any) {
      showError("Erro ao atualizar status da sessão: " + err.message);
      console.error("Erro ao atualizar status da sessão:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Evolução de Estudos</h1>
        <p className="text-lg text-muted-foreground">Carregando suas sessões de estudo...</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar sessões de estudo: " + error.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Evolução de Estudos</h1>
        <p className="text-lg text-red-500">Erro ao carregar sessões de estudo: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-foreground">Evolução de Estudos</h1>
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingSession(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingSession(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Sessão
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Editar Sessão de Estudo</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Atualize os detalhes da sua sessão de estudo.
              </DialogDescription>
            </DialogHeader>
            <StudySessionForm
              initialData={editingSession}
              onSessionSaved={refetch}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground">
        Registre e acompanhe suas sessões de estudo para ver seu progresso.
      </p>

      {studySessions && studySessions.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {studySessions.map((session) => (
            <Card key={session.id} className="flex flex-col h-full rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 pb-2">
                <div className="flex items-center gap-2 flex-grow min-w-0">
                  <Checkbox
                    id={`study-session-${session.id}`}
                    checked={session.is_completed}
                    onCheckedChange={() => handleToggleComplete(session.id, session.is_completed)}
                    className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                  />
                  <CardTitle className={`text-xl md:text-2xl font-semibold break-words ${session.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {session.title}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 mt-1 sm:mt-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEditSession(session)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Editar Sessão</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteSession(session.id,)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Deletar Sessão</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-grow p-3 pt-0">
                {session.description && (
                  <p className="text-xs text-muted-foreground break-words">{session.description}</p>
                )}
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3 flex-shrink-0" /> {formatDateTime(session.session_date, false)}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3 flex-shrink-0" /> {formatTime(session.start_time)} {session.end_time && `- ${formatTime(session.end_time)}`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-base md:text-lg">
          Nenhuma sessão de estudo encontrada. Adicione uma nova para começar a registrar seu progresso!
        </p>
      )}
    </div>
  );
};

export default Study;