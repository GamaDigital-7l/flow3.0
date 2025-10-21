import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, CheckCircle2, CalendarDays, Clock, BookOpen, Loader2 } from "lucide-react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { cn, formatDateTime, formatTime } from "@/lib/utils";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { showError, showSuccess } from "@/utils/toast";
import StudySessionForm, { StudySessionFormValues } from "@/components/StudySessionForm";
import { Checkbox } from "@/components/ui/checkbox";
import { parseISO } from "@/lib/utils";

interface StudySession extends Omit<StudySessionFormValues, 'session_date'> {
  id: string;
  session_date: string;
  created_at: string;
  updated_at: string;
}

const fetchStudySessions = async (userId: string): Promise<StudySession[]> => {
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as StudySession[] || [];
};

const Study: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: sessions, isLoading, error, refetch } = useQuery<StudySession[], Error>({
    queryKey: ["studySessions", userId],
    queryFn: () => fetchStudySessions(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<StudySession | undefined>(undefined);

  const handleSessionSaved = () => {
    refetch();
    setIsFormOpen(false);
    setEditingSession(undefined);
  };

  const handleEditSession = (session: StudySession) => {
    setEditingSession(session);
    setIsFormOpen(true);
  };

  const handleDeleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("study_sessions")
        .delete()
        .eq("id", sessionId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Sessão de estudo deletada com sucesso!");
      refetch();
    },
    onError: (err: any) => {
      showError("Erro ao deletar sessão: " + err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando sessões de estudo...
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar sessões de estudo: " + error.message);
    return <p className="text-red-500">Erro ao carregar sessões de estudo.</p>;
  }

  const totalMinutes = sessions?.reduce((sum, s) => sum + s.duration_minutes, 0) || 0;
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-primary" /> Estudos
        </h1>
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
              <DialogTitle className="text-foreground">{editingSession ? "Editar Sessão" : "Adicionar Nova Sessão de Estudo"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingSession ? "Atualize os detalhes da sua sessão de estudo." : "Registre uma nova sessão de estudo para acompanhar seu tempo dedicado."}
              </DialogDescription>
            </DialogHeader>
            <StudySessionForm
              initialData={editingSession ? { ...editingSession, session_date: parseISO(editingSession.session_date) } as any : undefined}
              onSessionSaved={handleSessionSaved}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground mb-8">
        Acompanhe seu tempo de estudo e mantenha o foco no aprendizado contínuo.
      </p>

      {/* Resumo */}
      <Card className="mb-8 bg-card border-border shadow-lg frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Resumo de Estudos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <p className="text-lg font-medium text-muted-foreground">Total de Horas Dedicadas:</p>
            <p className="text-2xl font-bold text-primary">{totalHours}h</p>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Sessões */}
      <Card className="bg-card border-border shadow-lg frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Sessões Registradas ({sessions?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessions && sessions.length > 0 ? (
            sessions.map(session => (
              <div key={session.id} className="p-3 border border-border rounded-lg bg-muted/20 space-y-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-foreground">{session.title}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEditSession(session)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteSession.mutate(session.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" /> {formatDateTime(session.session_date, false)}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-4 w-4" /> Duração: {session.duration_minutes} minutos
                </p>
                {session.notes && (
                  <p className="text-xs text-muted-foreground mt-2 border-t pt-1 line-clamp-2">{session.notes}</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhuma sessão de estudo registrada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Study;