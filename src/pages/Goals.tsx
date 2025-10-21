import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, CalendarIcon, CheckCircle2, Hourglass, PlayCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import FinancialGoalForm from "@/components/finance/FinancialGoalForm";
import { format } from "date-fns/format";
import { ptBR } from "date-fns/locale/pt-BR";
import { useSession } from "@/integrations/supabase/auth";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";

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

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setIsFormOpen(true);
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta meta?")) {
      try {
        const { error } = await supabase
          .from("goals")
          .delete()
          .eq("id", goalId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Meta deletada com sucesso!");
        refetch();
      } catch (err: any) {
        showError("Erro ao deletar meta: " + err.message);
        console.error("Erro ao deletar meta:", err);
      }
    }
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
                  {editingGoal ? "Atualize os detalhes da sua meta." : "Crie uma nova meta para acompanhar seu progresso."}
                </DialogDescription>
              </DialogHeader>
              <FinancialGoalForm
                initialData={editingGoal ? { ...editingGoal, target_date: editingGoal.target_date ? new Date(editingGoal.target_date) : undefined } : undefined}
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
          {goals.map((goal) => (
            <Card key={goal.id} className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200 frosted-glass card-hover-effect">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-xl md:text-2xl font-semibold text-foreground break-words">{goal.title}</CardTitle>
                <div className="flex items-center gap-2 flex-shrink-0">
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
              <CardContent className="flex-grow">
                {goal.description && (
                  <CardDescription className="mb-2 text-muted-foreground break-words text-sm md:text-base">
                    {goal.description}
                  </CardDescription>
                )}
                {goal.target_date && (
                  <p className="text-sm md:text-base text-muted-foreground flex items-center gap-1 mb-2">
                    <CalendarIcon className="h-4 w-4 text-primary flex-shrink-0" /> Data Alvo: {format(new Date(goal.target_date), "PPP", { locale: ptBR })}
                  </p>
                )}
                <p className="text-sm md:text-base text-muted-foreground flex items-center gap-1">
                  {getStatusIcon(goal.status)} Status: {getStatusText(goal.status)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-base md:text-lg">Nenhuma meta encontrada. Adicione uma nova meta para começar!</p>
      )}

      <div className="flex-1 flex items-end justify-center mt-8">
      </div>
    </div>
  );
};

export default Goals;