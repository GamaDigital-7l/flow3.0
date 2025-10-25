import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Repeat, Loader2, AlertCircle } from 'lucide-react';
import { Habit } from '@/types/habit';
import HabitItem from '../HabitItem';

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
  const activeHabits = habits.filter(h => !h.is_completed && !h.paused);
  const completedHabits = habits.filter(h => h.is_completed);

  return (
    <Card className="bg-card border-border shadow-lg card-hover-effect flex flex-col min-w-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Repeat className="h-5 w-5 text-status-recurring" /> Hábitos de Hoje
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3 flex-grow flex flex-col">
        <div className="space-y-3 flex-grow min-h-[100px]">
          {isLoading && (
            <div className="flex items-center justify-center p-4 text-primary">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
            </div>
          )}
          
          {error && (
            <div className="flex items-center p-4 text-red-500 bg-red-500/10 rounded-lg">
              <AlertCircle className="h-5 w-5 mr-2" /> Erro ao carregar hábitos.
            </div>
          )}

          {!isLoading && activeHabits.length === 0 && completedHabits.length === 0 && (
            <p className="text-muted-foreground p-4 text-center">Nenhum hábito para hoje. <a href="/recurrence" className="text-primary underline">Crie um novo hábito</a>.</p>
          )}

          {/* Hábitos Ativos */}
          {activeHabits.map(habit => (
            <HabitItem 
              key={habit.id} 
              habit={habit} 
              refetchHabits={refetchHabits} 
              showActions={true}
            />
          ))}
          
          {/* Hábitos Concluídos */}
          {completedHabits.length > 0 && (
            <div className="pt-2 border-t border-border mt-3">
              <p className="text-sm font-semibold text-muted-foreground mb-2">Concluídos ({completedHabits.length})</p>
              {completedHabits.map(habit => (
                <HabitItem 
                  key={habit.id} 
                  habit={habit} 
                  refetchHabits={refetchHabits} 
                  showActions={false}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default HabitListBoard;