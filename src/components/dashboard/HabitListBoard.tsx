// src/components/dashboard/HabitListBoard.tsx
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Repeat, PlusCircle } from "lucide-react";
import { Habit } from "@/types/habit";
import HabitItem from "@/components/HabitItem";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import HabitForm from "../HabitForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface HabitListBoardProps {
  habits: Habit[];
  isLoading: boolean;
  error: Error | null;
  refetchHabits: () => void;
}

const HabitListBoard: React.FC<HabitListBoardProps> = ({
  habits,
  isLoading,
  error,
  refetchHabits,
}) => {
  const [isFormOpen, setIsFormOpen] = React.useState(false);

  if (isLoading) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Repeat className="h-4 w-4 text-status-recurring" /> Hábitos Recorrentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-muted-foreground text-sm">Carregando hábitos...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Repeat className="h-4 w-4 text-status-recurring" /> Hábitos Recorrentes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <p className="text-red-500 text-sm">Erro ao carregar hábitos: {error.message}</p>
        </CardContent>
      </Card>
    );
  }
  
  const activeHabits = habits.filter(h => !h.paused);

  return (
    <Card className="w-full bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1 flex-wrap gap-1 flex-shrink-0">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <Repeat className="h-4 w-4 text-status-recurring" /> Recorrentes ({activeHabits.length})
        </CardTitle>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="ghost" onClick={() => setIsFormOpen(true)} className="h-7 w-7 text-primary hover:bg-primary/10">
              <PlusCircle className="h-4 w-4" />
              <span className="sr-only">Adicionar Hábito</span>
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Adicionar Novo Hábito</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Crie um hábito recorrente para acompanhar sua consistência.
              </DialogDescription>
            </DialogHeader>
            <HabitForm onHabitSaved={refetchHabits} onClose={() => setIsFormOpen(false)} />
          </DialogContent>
        </Dialog>
      </CardHeader>
      
      <div className="max-h-[85vh] overflow-y-auto custom-scrollbar flex-1">
        <CardContent className="p-2 pt-1 space-y-1">
          {activeHabits.length === 0 ? (
            <p className="text-muted-foreground text-xs">Nenhum hábito ativo para hoje. <Link to="/recurrence" className="text-primary underline">Gerenciar hábitos</Link>.</p>
          ) : (
            activeHabits.map((habit) => (
              <HabitItem key={habit.id} habit={habit} refetchHabits={refetchHabits} compactMode={true} showActions={false} />
            ))
          )}
        </CardContent>
      </div>
    </Card>
  );
};

export default HabitListBoard;