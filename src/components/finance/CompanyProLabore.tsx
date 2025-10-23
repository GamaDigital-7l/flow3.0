"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Banknote, Loader2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import ProLaboreForm from './ProLaboreForm';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';

const fetchProLaboreSettings = async (userId: string) => {
  const { data, error } = await supabase
    .from("pro_labore_settings")
    .select(`
      *,
      target_account:financial_accounts(id, name)
    `)
    .eq("user_id", userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const renderLoading = () => (
  <div className="flex items-center justify-center p-4">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const CompanyProLabore: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isProLaboreFormOpen, setIsProLaboreFormOpen] = useState(false);

  const { data: proLaboreSettings, isLoading: isLoadingProLabore, refetch: refetchProLabore } = useQuery({
    queryKey: ["proLaboreSettings", userId],
    queryFn: () => fetchProLaboreSettings(userId!),
    enabled: !!userId,
  });

  const handleProLaboreSaved = () => {
    refetchProLabore();
    setIsProLaboreFormOpen(false);
    // Invalidate related queries (e.g., recurrences or transactions if Pro Labore creates one)
    queryClient.invalidateQueries({ queryKey: ["companyRecurrences", userId] });
  };

  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass card-hover-effect">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2 flex-1 min-w-0 break-words">
          <Banknote className="h-5 w-5 text-green-500 flex-shrink-0" /> Pro Labore
        </CardTitle>
        <Dialog open={isProLaboreFormOpen} onOpenChange={setIsProLaboreFormOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/10 flex-shrink-0">
              {proLaboreSettings ? "Editar" : "Configurar"}
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">Configurar Pro Labore</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Defina o valor e o dia de pagamento do seu Pro Labore.
              </DialogDescription>
            </DialogHeader>
            <ProLaboreForm
              initialData={proLaboreSettings}
              onProLaboreSaved={handleProLaboreSaved}
              onClose={() => setIsProLaboreFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoadingProLabore ? renderLoading() : proLaboreSettings ? (
          <div className="space-y-1">
            <p className="text-lg font-bold text-foreground">{formatCurrency(proLaboreSettings.amount)}</p>
            <p className="text-sm text-muted-foreground">Dia de Pagamento: {proLaboreSettings.payment_day_of_month}</p>
            <p className="text-sm text-muted-foreground">Conta Alvo: {proLaboreSettings.target_account?.name || 'Não definida'}</p>
          </div>
        ) : (
          <p className="text-muted-foreground">Nenhuma configuração de Pro Labore encontrada.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default CompanyProLabore;