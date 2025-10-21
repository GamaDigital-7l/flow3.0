import React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, CalendarIcon, CheckCircle2, Hourglass, PlayCircle, TrendingDown, TrendingUp } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { showError, showSuccess } from "@/utils/toast";
import GoalForm, { GoalFormValues } from "@/components/GoalForm";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { parseISO } from "@/lib/utils";

interface Goal extends Omit<GoalFormValues, 'target_date'> {
  id: string;
  target_date: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

const fetchGoals = async (userId: string): Promise<Goal[]> => {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("target_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data as Goal[] || [];
};

const Goals: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  // Placeholder for latestWeight (should be fetched in a real app)
  const latestWeight = 70; 

  const { data: goals, isLoading, error, refetch } = useQuery<Goal[], Error>({
    queryKey: ["goals", userId],
    queryFn: () => fetchGoals(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<Goal | undefined>(undefined);

  const handleGoalSaved = () => {
    refetch();
    setIsFormOpen(false);
    setEditingGoal(undefined);
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setIsFormOpen(true);
  };

  const handleDeleteGoal = useMutation({
    mutationFn: async (goalId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", goalId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Meta deletada com sucesso!");
      refetch();
    },
    onError: (err: any) => {
      showError("Erro ao deletar meta: " + err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando metas...
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar metas: " + error.message);
    return <p className="text-red-500">Erro ao carregar metas.</p>;
  }

  const activeGoals = goals?.filter(g => g.status !== 'completed' && g.status !== 'archived') || [];
  const completedGoals = goals?.filter(g => g.status === 'completed') || [];

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Target className="h-7 w-7 text-primary" /> Metas
        </h1>
        <Dialog
          open={isFormOpen}
          onOpenChange={(open) => {
            setIsFormOpen(open);
            if (!open) setEditingGoal(undefined);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditingGoal(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Meta
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingGoal ? "Editar Meta" : "Adicionar Nova Meta"}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {editingGoal ? "Atualize os detalhes da sua meta." : "Defina uma nova meta para o seu desenvolvimento."}
              </DialogDescription>
            </DialogHeader>
            <GoalForm
              initialData={editingGoal ? { ...editingGoal, target_date: editingGoal.target_date ? parseISO(editingGoal.target_date) : undefined } as any : undefined}
              onGoalSaved={handleGoalSaved}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground mb-8">
        Acompanhe seu progresso em direção aos seus objetivos de longo prazo.
      </p>

      {/* Metas Ativas */}
      <Card className="mb-8 bg-card border-border shadow-lg frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground">Metas Ativas ({activeGoals.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeGoals.length > 0 ? (
            activeGoals.map(goal => {
              const targetDate = goal.target_date ? parseISO(goal.target_date) : null;
              const daysRemaining = targetDate ? differenceInDays(targetDate, new Date()) : null;
              const progress = (goal.current_value / goal.target_value) * 100;

              return (
                <div key={goal.id} className="p-4 border border-border rounded-lg bg-muted/20 space-y-2">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg text-foreground">{goal.title}</h3>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEditGoal(goal)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal.mutate(goal.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{goal.description}</p>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm font-medium">
                      <Label>Progresso: {goal.current_value} / {goal.target_value} {goal.unit}</Label>
                      <Label>{progress.toFixed(0)}%</Label>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>

                  <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                    {targetDate && (
                      <p className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" /> Prazo: {format(targetDate, "PPP", { locale: ptBR })}
                      </p>
                    )}
                    {daysRemaining !== null && (
                      <p className="flex items-center gap-1">
                        <Hourglass className="h-3 w-3" /> {daysRemaining >= 0 ? `${daysRemaining} dias restantes` : `${Math.abs(daysRemaining)} dias atrasado`}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-muted-foreground">Nenhuma meta ativa no momento. Adicione uma nova meta!</p>
          )}
        </CardContent>
      </Card>

      {/* Metas Concluídas */}
      {completedGoals.length > 0 && (
        <Card className="bg-card border-border shadow-lg frosted-glass card-hover-effect">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-green-600 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" /> Concluídas ({completedGoals.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedGoals.map(goal => (
              <div key={goal.id} className="p-3 border border-green-500/50 rounded-lg bg-green-500/10">
                <p className="font-semibold text-foreground line-through">{goal.title}</p>
                <p className="text-xs text-muted-foreground">Concluída em: {format(parseISO(goal.updated_at), "PPP", { locale: ptBR })}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Goals;