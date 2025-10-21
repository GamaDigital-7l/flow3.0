import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Trash2, Edit, Copy } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription, // Importação adicionada
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle, // Importação adicionada para acessibilidade
  DialogTrigger,
  DialogDescription, // Importação adicionada para acessibilidade
  DialogFooter
} from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showSuccess, showError } from '@/utils/toast';
import BriefingForm from '@/components/briefing/BriefingForm';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Briefing {
  id: string;
  title: string;
  description: string | null;
  questions: any[];
  created_at: string;
  updated_at: string;
  user_id: string;
}

const BriefingPage: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBriefing, setEditingBriefing] = useState<Briefing | null>(null);

  const { data: briefings, isLoading, error } = useQuery<Briefing[]>({
    queryKey: ['briefings', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('briefings')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!userId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (briefingId: string) => {
      const { error } = await supabase
        .from('briefings')
        .delete()
        .eq('id', briefingId)
        .eq('user_id', userId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['briefings'] });
      showSuccess('Briefing excluído com sucesso!');
    },
    onError: (err) => {
      showError('Erro ao excluir briefing: ' + err.message);
    },
  });

  const handleEdit = (briefing: Briefing) => {
    setEditingBriefing(briefing);
    setIsDialogOpen(true);
  };

  const handleNewBriefing = () => {
    setEditingBriefing(null);
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingBriefing(null);
  };

  const handleCopyLink = (briefingId: string) => {
    const publicUrl = `${window.location.origin}/briefing/${briefingId}`; // Ajustar se necessário
    navigator.clipboard.writeText(publicUrl);
    showSuccess('Link do briefing copiado para a área de transferência!');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive">Erro ao carregar briefings: {error.message}</div>;
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Meus Briefings</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewBriefing} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Briefing
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle>{editingBriefing ? 'Editar Briefing' : 'Criar Novo Briefing'}</DialogTitle>
              <DialogDescription>
                {editingBriefing ? 'Ajuste os detalhes e perguntas do seu briefing.' : 'Crie um novo formulário de briefing para seus clientes.'}
              </DialogDescription>
            </DialogHeader>
            <BriefingForm
              initialData={editingBriefing}
              onBriefingSaved={handleCloseDialog}
              onClose={handleCloseDialog}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {briefings && briefings.length > 0 ? (
          briefings.map((briefing) => (
            <Card key={briefing.id} className="flex flex-col justify-between card-hover-effect">
              <CardHeader>
                <CardTitle className="text-lg">{briefing.title}</CardTitle>
                <CardDescription className="text-muted-foreground text-sm line-clamp-2">
                  {briefing.description || 'Sem descrição.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p>Perguntas: {briefing.questions.length}</p>
                <p>Atualizado em: {format(new Date(briefing.updated_at), 'dd/MM/yyyy')}</p> {/* FIX TS2554 */}
              </CardContent>
              <CardFooter className="flex justify-between gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleEdit(briefing)}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-2" /> Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyLink(briefing.id)}
                  className="text-primary hover:bg-primary/10"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => deleteMutation.mutate(briefing.id)}
                  disabled={deleteMutation.isPending}
                  className="text-destructive hover:bg-destructive/10"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))
        ) : (
          <p className="col-span-full text-center text-muted-foreground p-8 border border-dashed rounded-lg">
            Nenhum briefing encontrado. Clique em "Novo Briefing" para começar.
          </p>
        )}
      </div>
    </div>
  );
};

export default BriefingPage;