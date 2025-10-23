"use client";

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { showError } from '@/utils/toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, MessageSquare, User, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDateTime } from '@/lib/utils';

interface Question {
  id: string;
  text: string;
  type: "text" | "textarea" | "select" | "checkbox" | "number" | "date" | "email" | "phone" | "url";
}

interface BriefingResponse {
  id: string;
  form_id: string;
  response_data: Record<string, any>;
  client_name: string | null;
  submitted_at: string;
}

interface Briefing {
  id: string;
  title: string;
  form_structure: Question[];
}

const fetchBriefingAndResponses = async (userId: string, briefingId: string): Promise<{ briefing: Briefing | null, responses: BriefingResponse[] }> => {
  // 1. Buscar o briefing (para obter a estrutura das perguntas)
  const { data: briefingData, error: briefingError } = await supabase
    .from('briefing_forms')
    .select('id, title, form_structure')
    .eq('id', briefingId)
    .eq('created_by', userId) // RLS garante que só o criador veja
    .single();

  if (briefingError && briefingError.code !== 'PGRST116') throw briefingError;
  const briefing = briefingData as Briefing | null;

  if (!briefing) {
    return { briefing: null, responses: [] };
  }

  // 2. Buscar as respostas
  const { data: responsesData, error: responsesError } = await supabase
    .from('briefing_responses')
    .select('*')
    .eq('form_id', briefingId)
    .order('submitted_at', { ascending: false });

  if (responsesError) throw responsesError;

  return { briefing, responses: responsesData as BriefingResponse[] || [] };
};

const BriefingResponses: React.FC = () => {
  const { briefingId } = useParams<{ briefingId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user?.id;

  const [selectedResponse, setSelectedResponse] = useState<BriefingResponse | null>(null);
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['briefingResponses', briefingId, userId],
    queryFn: () => fetchBriefingAndResponses(userId!, briefingId!),
    enabled: !!userId && !!briefingId,
  });

  if (!briefingId) {
    return <div className="p-8 text-red-500">ID do Briefing não fornecido.</div>;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar respostas: " + error.message);
    return <div className="p-8 text-red-500">Erro ao carregar respostas: {error.message}</div>;
  }

  const briefing = data?.briefing;
  const responses = data?.responses || [];

  if (!briefing) {
    return (
      <div className="p-8">
        <Card className="bg-card border border-border rounded-xl shadow-lg p-6 text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-3">Briefing Não Encontrado</h2>
          <p className="text-muted-foreground">O formulário de briefing não existe ou você não tem permissão para visualizá-lo.</p>
          <Button onClick={() => navigate('/briefing')} variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para a Lista
          </Button>
        </Card>
      </div>
    );
  }

  const handleViewResponse = (response: BriefingResponse) => {
    setSelectedResponse(response);
    setIsResponseDialogOpen(true);
  };

  const renderResponseValue = (questionType: string, value: any) => {
    if (value === null || value === undefined || value === "") {
      return <span className="text-muted-foreground italic">Não respondido</span>;
    }
    
    // Tenta converter a string de data ISO para Date para formatação
    if (questionType === 'date' && typeof value === 'string') {
      try {
        const dateObj = new Date(value);
        if (!isNaN(dateObj.getTime())) {
          return format(dateObj, 'dd/MM/yyyy');
        }
      } catch (e) {
        // Ignora erro de parse
      }
    }
    
    if (questionType === 'checkbox') {
      return value ? <span className="text-green-500">Sim</span> : <span className="text-red-500">Não</span>;
    }
    if (questionType === 'url') {
      return <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline truncate block max-w-xs">{value}</a>;
    }
    if (questionType === 'textarea') {
      return <p className="whitespace-pre-wrap text-sm">{value}</p>;
    }
    
    return String(value);
  };

  return (
    <div className="page-content-wrapper space-y-6">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/briefing')} className="border-border text-foreground hover:bg-accent hover:text-accent-foreground flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Voltar</span>
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">{briefing.title}</h1>
          <p className="text-sm text-muted-foreground">Respostas Recebidas</p>
        </div>
      </div>

      <Card className="bg-card border border-border rounded-xl shadow-sm frosted-glass">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> Total de Respostas ({responses.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {responses.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma resposta foi enviada para este briefing ainda.</p>
          ) : (
            <ScrollArea className="h-[400px] w-full border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-[200px]">Submetido por</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responses.map((response) => (
                    <TableRow key={response.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => handleViewResponse(response)}>
                      <TableCell className="font-medium flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {response.client_name || 'Anônimo'}
                      </TableCell>
                      <TableCell>
                        {formatDateTime(new Date(response.submitted_at), true)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleViewResponse(response); }}>
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Dialog para Visualização Detalhada da Resposta */}
      <Dialog open={isResponseDialogOpen} onOpenChange={setIsResponseDialogOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Detalhes da Resposta</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Resposta submetida por {selectedResponse?.client_name || 'Anônimo'} em {selectedResponse?.submitted_at ? formatDateTime(new Date(selectedResponse.submitted_at), true) : 'N/A'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {briefing && selectedResponse && briefing.form_structure.map((question) => (
              <div key={question.id} className="p-3 border border-border rounded-md bg-muted/20">
                <p className="text-sm font-semibold text-foreground mb-1">{question.text}</p>
                <Card className="bg-input border-border p-2">
                  <CardContent className="p-0 text-sm text-foreground">
                    {renderResponseValue(question.type, selectedResponse.response_data[question.id])}
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BriefingResponses;