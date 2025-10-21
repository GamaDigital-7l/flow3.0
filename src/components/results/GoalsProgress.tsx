import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';

interface Goal {
  id: string;
  title: string;
  description?: string | null;
  target_date?: string | null;
  status: string;
}

const fetchGoals = async (userId: string): Promise<Goal[]> => {
  const { data, error } = await supabase
    .from("goals")
    .select("id, title, description, target_date, status")
    .eq("user_id", userId)
    .neq("status", "completed")
    .order("target_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
};

const GoalsProgress: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: goals, isLoading } = useQuery<Goal[], Error>({
    queryKey: ["activeGoalsForResults", userId],
    queryFn: () => fetchGoals(userId!),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="bg-card border-border shadow-sm frosted-glass card-hover-effect">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" /> Metas Ativas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {goals && goals.length > 0 ? (
          goals.map(goal => (
            <div key={goal.id} className="p-3 bg-muted/20 rounded-lg border border-border">
              <p className="font-semibold text-foreground">{goal.title}</p>
              {goal.target_date && (
                <p className="text-xs text-muted-foreground">
                  Prazo: {format(new Date(goal.target_date), "PPP")} {/* FIX TS2554 */}
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="text-muted-foreground">Nenhuma meta ativa no momento. Defina uma nova meta!</p>
        )}
      </CardContent>
    </Card>
  );
};

export default GoalsProgress;