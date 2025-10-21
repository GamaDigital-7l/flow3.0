import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, CalendarIcon, CheckCircle2, Hourglass, PlayCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants"; // Importando GoalFormValues

interface Goal extends Omit<GoalFormValues, 'target_date'> {
  id: string;
  created_at: string;
  updated_at: string;
  target_date?: string | null;
  status: "pending" | "in_progress" | "completed";
}

const fetchGoals = async (userId: string): Promise<Goal[]> => {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "completed")
    .order("target_date", { ascending: true, nullsFirst: false });
  if (error) {
    throw error;
  }
  return data || [];
};

const Goals: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: goals, isLoading, error, refetch } = useQuery<Goal[], Error>({
    queryKey: ["goals", userId],
    queryFn: () => fetchGoals(userId!),
    enabled: !!userId,
  });

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<Goal | undefined>(undefined);

  const handleDeleteGoal = useMutation({
    mutationFn: async (goalId: string) => {
      if (!userId) {
        showError("Usuário não autenticado.");
        return;
      }
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
      console.error("Erro ao deletar meta:", err);
    },
  });

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setIsFormOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Hourglass className="h-4 w-4 text-gray-500 flex-shrink-0" />;
      case "in_progress":
        return <PlayCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "in_progress":
        return "Em Progresso";
      case "completed":
        return "Concluída";
      default:
        return "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Suas Metas</h1>
        <p className="text-lg text-muted-foreground">Carregando suas metas...</p>
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar metas: " + error.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Suas Metas</h1>
        <p className="text-lg text-red-500">Erro ao carregar metas: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-foreground">Suas Metas</h1>
        <div className="flex gap-2 flex-wrap justify-end w-full sm:w-auto">
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
                <DialogTitle className="text-foreground">
                  {editingGoal ? "Editar Meta" : "Adicionar Nova Meta"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Defina ou atualize uma meta para sua saúde.
                </DialogDescription>
              </DialogHeader>
              <GoalForm
                initialData={editingGoal}
                onGoalSaved={refetch}
                onClose={() => setIsFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <p className="text-lg text-muted-foreground">
        Defina e acompanhe suas metas de vida aqui.
      </p>

      {goals && goals.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {goals.map((goal) => {
            const totalToLose = goal.initial_weight_kg - goal.target_weight_kg;
            const currentWeightLost = latestWeight ? (goal.initial_weight_kg - latestWeight) : 0;
            const remainingToLose = totalToLose - currentWeightLost;
            const progressPercentage = totalToLose > 0 ? (currentWeightLost / totalToLose) * 100 : 0;
            const daysRemaining = differenceInDays(new Date(goal.target_date), new Date());

            return (
              <Card key={goal.id} className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200 frosted-glass card-hover-effect">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className={`text-xl md:text-2xl font-semibold break-words ${goal.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {goal.title}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-shrink-0 mt-1 sm:mt-0">
                    {goal.is_completed && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    <Button variant="ghost" size="icon" onClick={() => handleEditGoal(goal)} className="text-blue-500 hover:bg-blue-500/10">
                      <Edit className="h-4 w-4" />
                      <span className="sr-only">Editar Meta</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal.mutate(goal.id)} className="text-red-500 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Deletar Meta</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow space-y-2">
                  {goal.description && (
                    <CardDescription className="mb-2 text-muted-foreground break-words text-sm md:text-base">{goal.description}</CardDescription>
                  )}
                  {goal.target_date && (
                    <p className="text-sm md:text-base text-muted-foreground flex items-center gap-1 mb-2">
                      <CalendarIcon className="h-4 w-4 text-primary flex-shrink-0" /> Data Alvo: {format(new Date(goal.target_date), "PPP", { locale: ptBR })}
                    </p>
                  )}
                  <p className="text-sm md:text-base text-muted-foreground flex items-center gap-1">
                    Status: {goal.status}
                  </p>

                  {latestWeight !== null && (
                    <>
                      <p className="text-sm md:text-base text-foreground flex items-center gap-1 font-semibold mt-3">
                        <TrendingDown className="h-4 w-4 text-green-500 flex-shrink-0" /> Peso Atual: {latestWeight} kg
                      </p>
                      <p className="text-sm md:text-base text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0" /> Perdido até agora: {currentWeightLost.toFixed(2)} kg
                      </p>
                      <p className="text-sm md:text-base text-muted-foreground flex items-center gap-1">
                        <TrendingDown className="h-4 w-4 text-red-500 flex-shrink-0" /> Restante para perder: {remainingToLose.toFixed(2)} kg
                      </p>
                      <div className="mt-3">
                        <Label className="text-foreground text-sm md:text-base">Progresso</Label>
                        <Progress value={progressPercentage} className="w-full mt-1" />
                        <p className="text-xs md:text-sm text-muted-foreground text-right mt-1">{progressPercentage.toFixed(0)}%</p>
                      </div>
                    </>
                  )}
                  {latestWeight === null && (
                    <p className="text-sm md:text-base text-muted-foreground mt-3">
                      Adicione uma métrica de peso para ver o progresso da sua meta.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <p className="text-muted-foreground text-base md:text-lg">Nenhuma meta encontrada. Adicione uma nova meta para começar!</p>
      )}

      <div className="flex-1 flex items-end justify-center">
      </div>
    </div>
  );
};

export default Goals;