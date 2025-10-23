// src/pages/Recurrence.tsx
import React, { useState, useMemo } from "react";
import { useAllHabitDefinitions } from "@/hooks/useHabits";
import { useSession } from "@/integrations/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Repeat, Edit, CalendarDays, Pause, BarChart3, Play, Trash2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import HabitForm from "@/components/HabitForm";
import HabitItem from "@/components/HabitItem";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { Habit, WEEKDAY_LABELS } from "@/types/habit";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";

const Recurrence: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  // Usamos habitDefinitions que busca a última instância de cada recurrence_id
  const { habitDefinitions, isLoading, error, refetch } = useAllHabitDefinitions(); 
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | undefined>(undefined);

  const handleHabitSaved = () => {
    refetch();
    setIsFormOpen(false);
    setEditingHabit(undefined);
  };
  
  const handlePauseToggle = useMutation({
    mutationFn: async ({ recurrenceId, paused }: { recurrenceId: string, paused: boolean }) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      // Atualiza todas as instâncias com o mesmo recurrence_id
      const { error } = await supabase
        .from("habits")
        .update({ paused: paused, updated_at: new Date().toISOString() })
        .eq("recurrence_id", recurrenceId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (data, variables) => {
      showSuccess(`Hábito ${variables.paused ? 'pausado' : 'retomado'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["todayHabits", userId] });
      queryClient.invalidateQueries({ queryKey: ["allHabitDefinitions", userId] });
    },
    onError: (err: any) => {
      showError("Erro ao pausar/retomar hábito: " + err.message);
    },
  });
  
  const handleDeleteHabit = useMutation({
    mutationFn: async (recurrenceId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      if (!window.confirm("Tem certeza que deseja deletar ESTE HÁBITO e TODO O SEU HISTÓRICO?")) return;
      
      // Deleta todas as instâncias e o histórico associado ao recurrence_id
      const { error: deleteHistoryError } = await supabase
        .from("habit_history")
        .delete()
        .eq("recurrence_id", recurrenceId)
        .eq("user_id", userId);
        
      if (deleteHistoryError) console.error("Error deleting habit history:", deleteHistoryError);

      const { error: deleteHabitsError } = await supabase
        .from("habits")
        .delete()
        .eq("recurrence_id", recurrenceId)
        .eq("user_id", userId);

      if (deleteHabitsError) throw deleteHabitsError;
    },
    onSuccess: () => {
      showSuccess("Hábito e histórico deletados com sucesso!");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["todayHabits", userId] });
      queryClient.invalidateQueries({ queryKey: ["allHabitDefinitions", userId] });
    },
    onError: (err: any) => {
      showError("Erro ao deletar hábito: " + err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando hábitos...
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar hábitos: " + error.message);
    return <p className="text-red-500">Erro ao carregar hábitos.</p>;
  }
  
  const activeHabits = habitDefinitions?.filter(h => !h.paused) || [];
  const pausedHabits = habitDefinitions?.filter(h => h.paused) || [];

  const getWeekdayChartData = (failByWeekday: Habit['fail_by_weekday']) => {
    return Object.entries(WEEKDAY_LABELS).map(([key, label]) => ({
      name: label,
      Falhas: failByWeekday[parseInt(key)] || 0,
    }));
  };

  return (
    <div className="page-content-wrapper space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Repeat className="h-7 w-7 text-status-recurring" /> Hábitos e Recorrências
        </h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingHabit(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Hábito
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Novo Hábito</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Crie um hábito recorrente para acompanhar sua consistência.
              </DialogDescription>
            </DialogHeader>
            <HabitForm onHabitSaved={handleHabitSaved} onClose={() => setIsFormOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground mb-8">
        Gerencie seus hábitos, veja seu progresso e mantenha sua consistência.
      </p>

      {/* Hábitos Ativos */}
      <Card className="mb-8 bg-card border-border shadow-lg frosted-glass card-hover-effect">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-green-500" /> Hábitos Ativos ({activeHabits.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeHabits.length > 0 ? (
            activeHabits.map(habit => (
              <div key={habit.recurrence_id} className="p-4 border border-border rounded-lg bg-muted/20 space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg text-foreground">{habit.title}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingHabit(habit); setIsFormOpen(true); }} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handlePauseToggle.mutate({ recurrenceId: habit.recurrence_id, paused: true })} className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground">
                      <Pause className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteHabit.mutate(habit.recurrence_id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Métricas */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Streak Atual:</p>
                    <p className="font-bold text-primary">{habit.streak} dias</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Total Concluído:</p>
                    <p className="font-bold text-foreground">{habit.total_completed} vezes</p>
                  </div>
                </div>
                
                {/* Taxa de Sucesso */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm font-medium">
                    <Label>Taxa de Sucesso:</Label>
                    <Label>{habit.success_rate.toFixed(0)}%</Label>
                  </div>
                  <Progress value={habit.success_rate} className="h-2" />
                </div>
                
                {/* Gráfico de Falhas por Dia da Semana */}
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <h4 className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="h-4 w-4" /> Dias de Maior Falha
                  </h4>
                  <div className="h-32 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getWeekdayChartData(habit.fail_by_weekday)} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} allowDecimals={false} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.5rem' }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                        />
                        <Bar dataKey="Falhas" fill="hsl(var(--status-overdue))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground">Nenhum hábito ativo no momento. Adicione um novo hábito!</p>
          )}
        </CardContent>
      </Card>

      {/* Hábitos Pausados */}
      {pausedHabits.length > 0 && (
        <Card className="bg-card border-border shadow-lg frosted-glass card-hover-effect">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-muted-foreground flex items-center gap-2">
              <Pause className="h-5 w-5" /> Hábitos Pausados ({pausedHabits.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pausedHabits.map(habit => (
              <div key={habit.recurrence_id} className="p-3 border border-border rounded-lg bg-muted/20 flex justify-between items-center">
                <p className="font-semibold text-muted-foreground line-through">{habit.title}</p>
                <Button variant="ghost" size="icon" onClick={() => handlePauseToggle.mutate({ recurrenceId: habit.recurrence_id, paused: false })} className="h-7 w-7 text-green-500 hover:bg-green-500/10">
                  <Play className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Recurrence;