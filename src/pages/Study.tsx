"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, BookOpen, CheckCircle2, Hourglass, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import StudySessionForm, { StudySessionFormValues } from "@/components/StudySessionForm";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useSession } from "@/integrations/supabase/auth";
import { Checkbox } from "@/components/ui/checkbox";

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
          <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-foreground">
                {editingSession ? "Editar Sessão de Estudo" : "Adicionar Nova Sessão de Estudo"}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingSession ? "Atualize os detalhes da sua sessão de estudo." : "Registre uma nova sessão de estudo."}
              </DialogDescription>
            </DialogHeader>
            <StudySessionForm
              initialData={editingSession ? { ...editingSession, session_date: new Date(editingSession.session_date) } : undefined}
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
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {studySessions.map((session) => (
            <Card key={session.id} className="flex flex-col h-full bg-card border border-border rounded-lg shadow-sm hover:shadow-lg transition-shadow duration-200">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2 flex-grow min-w-0">
                  <Checkbox
                    id={`study-session-${session.id}`}
                    checked={session.is_completed}
                    onCheckedChange={() => handleToggleComplete(session.id, session.is_completed)}
                    className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                  />
                  <CardTitle className={`text-xl md:text-2xl font-semibold break-words min-w-0 ${session.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {session.title}
                  </CardTitle>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 mt-1 sm:mt-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEditSession(session)} className="text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Editar Sessão</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteSession(session.id)} className="text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Deletar Sessão</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                {session.notes && (
                  <CardDescription className="mb-2 text-muted-foreground break-words text-sm md:text-base">
                    {session.notes}
                  </CardDescription>
                )}
                <p className="text-sm md:text-base text-muted-foreground flex items-center gap-1 mb-1">
                  <BookOpen className="h-4 w-4 text-primary flex-shrink-0" /> Data: {format(new Date(session.session_date), "PPP", { locale: ptBR })}
                </p>
                {session.duration_minutes && (
                  <p className="text-sm md:text-base text-muted-foreground flex items-center gap-1">
                    <Clock className="h-4 w-4 text-primary flex-shrink-0" /> Duração: {session.duration_minutes} minutos
                  </p>
                )}
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