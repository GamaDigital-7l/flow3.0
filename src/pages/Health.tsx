"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, Scale, CalendarIcon, NotebookText, Target, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import HealthMetricForm, { HealthMetricFormValues } from "@/components/HealthMetricForm";
import HealthGoalForm, { HealthGoalFormValues } from "@/components/HealthGoalForm";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useSession } from "@/integrations/supabase/auth";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";

interface HealthMetric extends Omit<HealthMetricFormValues, 'date'> {
  id: string;
  created_at: string;
  updated_at: string;
  date: string;
}

interface HealthGoal extends Omit<HealthGoalFormValues, 'start_date' | 'target_date'> {
  id: string;
  created_at: string;
  updated_at: string;
  start_date: string;
  target_date: string;
  is_completed: boolean;
  description?: string | null;
  status: "pending" | "in_progress" | "completed";
}

const fetchHealthMetrics = async (userId: string): Promise<HealthMetric[]> => {
  const { data, error } = await supabase
    .from("health_metrics")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return data || [];
};

const fetchHealthGoals = async (userId: string): Promise<HealthGoal[]> => {
  const { data, error } = await supabase
    .from("health_goals")
    .select("*")
    .eq("user_id", userId)
    .order("target_date", { ascending: true });
  if (error) {
    throw error;
  }
  return data || [];
};

const Health: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: healthMetrics, isLoading: isLoadingMetrics, error: metricsError, refetch: refetchMetrics } = useQuery<HealthMetric[], Error>({
    queryKey: ["healthMetrics", userId],
    queryFn: () => fetchHealthMetrics(userId!),
    enabled: !!userId,
  });

  const { data: healthGoals, isLoading: isLoadingGoals, error: goalsError, refetch: refetchGoals } = useQuery<HealthGoal[], Error>({
    queryKey: ["healthGoals", userId],
    queryFn: () => fetchHealthGoals(userId!),
    enabled: !!userId,
  });

  const [isMetricFormOpen, setIsMetricFormOpen] = React.useState(false);
  const [editingMetric, setEditingMetric] = React.useState<HealthMetric | undefined>(undefined);

  const [isGoalFormOpen, setIsGoalFormOpen] = React.useState(false);
  const [editingGoal, setEditingGoal] = React.useState<HealthGoal | undefined>(undefined);

  const handleEditMetric = (metric: HealthMetric) => {
    setEditingMetric(metric);
    setIsMetricFormOpen(true);
  };

  const handleDeleteMetric = async (metricId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta métrica de saúde?")) {
      try {
        const { error } = await supabase
          .from("health_metrics")
          .delete()
          .eq("id", metricId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Métrica de saúde deletada com sucesso!");
        refetchMetrics();
      } catch (err: any) {
        showError("Erro ao deletar métrica de saúde: " + err.message);
        console.error("Erro ao deletar métrica de saúde:", err);
      }
    }
  };

  const handleEditGoal = (goal: HealthGoal) => {
    setEditingGoal(goal);
    setIsGoalFormOpen(true);
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    if (window.confirm("Tem certeza que deseja deletar esta meta de saúde?")) {
      try {
        const { error } = await supabase
          .from("health_goals")
          .delete()
          .eq("id", goalId)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Meta de saúde deletada com sucesso!");
        refetchGoals();
      } catch (err: any) {
        showError("Erro ao deletar meta de saúde: " + err.message);
        console.error("Erro ao deletar meta de saúde:", err);
      }
    }
  };

  const latestWeight = healthMetrics && healthMetrics.length > 0 ? healthMetrics[0].weight_kg : null;

  if (isLoadingMetrics || isLoadingGoals) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold text-foreground">Minha Saúde</h1>
        <p className="text-lg text-muted-foreground">Carregando suas métricas e metas de saúde...</p>
      </div>
    );
  }

  if (metricsError) {
    showError("Erro ao carregar métricas de saúde: " + metricsError.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Minha Saúde</h1>
        <p className="text-lg text-red-500">Erro ao carregar métricas de saúde: {metricsError.message}</p>
      </div>
    );
  }

  if (goalsError) {
    showError("Erro ao carregar metas de saúde: " + goalsError.message);
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6">
        <h1 className="text-3xl font-bold text-foreground">Minha Saúde</h1>
        <p className="text-lg text-red-500">Erro ao carregar metas de saúde: {goalsError.message}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:px-10 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold text-foreground">Minha Saúde</h1>
        <div className="flex gap-2 flex-wrap justify-end w-full sm:w-auto">
          <Dialog
            open={isGoalFormOpen}
            onOpenChange={(open) => {
              setIsGoalFormOpen(open);
              if (!open) setEditingGoal(undefined);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setEditingGoal(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                <Target className="mr-2 h-4 w-4" /> Adicionar Meta
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {editingGoal ? "Editar Meta de Saúde" : "Adicionar Nova Meta de Saúde"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Defina ou atualize uma meta para sua saúde.
                </DialogDescription>
              </DialogHeader>
              <HealthGoalForm
                initialData={editingGoal ? {
                  ...editingGoal,
                  start_date: new Date(editingGoal.start_date),
                  target_date: new Date(editingGoal.target_date),
                } : undefined}
                onGoalSaved={refetchGoals}
                onClose={() => setIsGoalFormOpen(false)}
              />
            </DialogContent>
          </Dialog>

          <Dialog
            open={isMetricFormOpen}
            onOpenChange={(open) => {
              setIsMetricFormOpen(open);
              if (!open) setEditingMetric(undefined);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={() => setEditingMetric(undefined)} variant="outline" className="w-full sm:w-auto border-primary text-primary hover:bg-primary/10">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Métrica
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] w-[90vw] bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  {editingMetric ? "Editar Métrica de Saúde" : "Adicionar Nova Métrica de Saúde"}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Registre ou atualize suas métricas de saúde.
                </DialogDescription>
              </DialogHeader>
              <HealthMetricForm
                initialData={editingMetric ? { ...editingMetric, date: new Date(editingMetric.date) } : undefined}
                onMetricSaved={refetchMetrics}
                onClose={() => setIsMetricFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <p className="text-lg text-muted-foreground">
        Registre e acompanhe seu peso, outras métricas e suas metas de saúde.
      </p>

      <h2 className="text-2xl md:text-3xl font-bold text-foreground mt-6">Minhas Metas de Saúde</h2>
      {healthGoals && healthGoals.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {healthGoals.map((goal) => {
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
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteGoal(goal.id)} className="text-red-500 hover:bg-red-500/10">
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
        <p className="text-muted-foreground text-base md:text-lg">Nenhuma meta de saúde encontrada. Adicione uma nova meta para começar a acompanhar seu progresso!</p>
      )}

      <h2 className="text-2xl md:text-3xl font-bold text-foreground mt-6">Minhas Métricas de Saúde</h2>
      {healthMetrics && healthMetrics.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {healthMetrics.map((metric) => (
            <Card key={metric.id} className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm hover:shadow-lg transition-shadow duration-200 frosted-glass card-hover-effect">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xl md:text-2xl font-semibold text-foreground break-words">
                  {metric.weight_kg ? `${metric.weight_kg} kg` : "Métrica de Saúde"}
                </CardTitle>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => handleEditMetric(metric)} className="text-blue-500 hover:bg-blue-500/10">
                    <Edit className="h-4 w-4" />
                    <span className="sr-only">Editar Métrica</span>
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteMetric(metric.id)} className="text-red-500 hover:bg-red-500/10">
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Deletar Métrica</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm md:text-base text-muted-foreground flex items-center gap-1 mb-1">
                  <CalendarIcon className="h-4 w-4 text-primary flex-shrink-0" /> Data: {format(new Date(metric.date), "PPP", { locale: ptBR })}
                </p>
                {metric.notes && (
                  <p className="text-sm md:text-base text-muted-foreground flex items-start gap-1 break-words">
                    <NotebookText className="h-4 w-4 text-primary flex-shrink-0 mt-1" /> Notas: {metric.notes}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-base md:text-lg">Nenhuma métrica de saúde encontrada. Adicione uma nova para começar a acompanhar seu progresso!</p>
      )}
    </div>
  );
};

export default Health;