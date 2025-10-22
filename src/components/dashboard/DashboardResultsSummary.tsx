"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, CheckCircle2, Repeat, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Profile {
  points: number;
}

const fetchProfile = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("points")
    .eq("id", userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
};

const DashboardResultsSummary: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;

  const { data: profile, isLoading } = useQuery<Profile | null, Error>({
    queryKey: ["profileDashboardSummary", userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="frosted-glass">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-3/4 mb-1" />
              <Skeleton className="h-3 w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="frosted-glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pontos de Produtividade</CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">{profile?.points || 0}</div>
          <p className="text-xs text-muted-foreground">Pontos acumulados.</p>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tarefas Concluídas (Hoje)</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">N/A</div>
          <p className="text-xs text-muted-foreground">Métricas detalhadas em Resultados.</p>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Maior Streak Diário</CardTitle>
          <Repeat className="h-4 w-4 text-orange-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-foreground">N/A</div>
          <p className="text-xs text-muted-foreground">Acompanhe suas recorrentes.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardResultsSummary;