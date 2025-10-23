import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from "@/integrations/supabase/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Repeat, Loader2 } from 'lucide-react';
import { RecurringTransaction } from '@/types/finance';
import { formatCurrency } from '@/utils/formatters';
import { format } from 'date-fns';
import { isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { cn } from '@/lib/utils';

interface DashboardRecurrencesProps {
  
}

const fetchUpcomingRecurrences = async (userId: string): Promise<RecurringTransaction[]> => {
  const today = new Date().toISOString();
  const { data, error } = await supabase
    .from("financial_recurrences")
    .select(`
      id, description, amount, type, start_date, recurrence_type,
      account:financial_accounts(name)
    `)
    .eq("user_id", userId)
    .eq("is_active", true)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(5);

  if (error) throw error;
  return data as RecurringTransaction[];
};

const DashboardRecurrences: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: recurrences, isLoading, error } = useQuery<RecurringTransaction[], Error>({
    queryKey: ["dashboardRecurrences", userId],
    queryFn: () => fetchUpcomingRecurrences(userId!),
    enabled: !!userId,
  });

  return (
    <Card className="frosted-glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="h-5 w-5 text-orange-500" /> Próximas Recorrências
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
        {error && <p className="text-red-500">Erro ao carregar recorrências.</p>}
        {!isLoading && !error && recurrences && recurrences.length === 0 && (
          <p className="text-muted-foreground">Nenhuma recorrência futura encontrada.</p>
        )}
        <div className="space-y-3">
          {recurrences?.map(rec => (
            <div key={rec.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{rec.description}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(rec.start_date), 'dd/MM/yyyy')}
                </p>
              </div>
              <p className={cn("font-semibold", rec.type === 'income' ? 'text-green-500' : 'text-red-500')}>
                {formatCurrency(rec.amount)}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardRecurrences;