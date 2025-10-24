"use client";

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
// ADDED ThumbsUp, MessageSquare, AlertTriangle, Info, CheckCircle
import { Loader2, CheckCircle2, XCircle, Edit, FileText, Clock, Users, DollarSign, ThumbsUp, MessageSquare, AlertTriangle, Info, CheckCircle } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { format, addDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale/pt-BR';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
// ADDED getInitials
import { cn, formatCurrency, formatDateTime, getInitials } from '@/lib/utils';
import { Proposal, ProposalItem, PROPOSAL_STATUS_LABELS } from '@/types/proposal';
import { Separator } from '@/components/ui/separator';
import ProposalPortfolioGallery from '@/components/proposal/ProposalPortfolioGallery'; // Importando a galeria
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Tipos simplificados
type ClientTaskStatus = "in_progress" | "under_review" | "approved" | "edit_requested" | "posted";
interface ClientTask {
  id: string;
  title: string;
  description: string | null;
  status: ClientTaskStatus;
  image_urls: string[] | null;
  client_id: string;
  edit_reason: string | null;
  clients: {
    name: string;
    logo_url: string | null;
  } | null;
}

interface PublicApprovalLink {
  id: string;
  unique_id: string;
  client_id: string;
  user_id: string;
  month_year_reference: string;
  expires_at: string;
  is_active: boolean;
  created_at: string; // Added created_at for expiration check
}

interface ApprovalData {
  link: PublicApprovalLink;
  client: { name: string; logo_url: string | null };
  tasks: ClientTask[];
}

// Função para buscar os dados no lado do cliente
const loadData = async (linkId: string): Promise<ApprovalData | null> => {
  // 1. Buscar o link
  const { data: linkData, error: linkError } = await supabase
    .from('public_approval_links')
    .select('*') // Selecting all fields to ensure created_at, id, unique_id, is_active are present
    .eq('unique_id', linkId)
    .single();

  if (linkError || !linkData) {
    throw new Error('Link de aprovação inválido ou não encontrado.');
  }

  // 2. Verificar se o link expirou (7 dias)
  const createdAt = new Date(linkData.created_at); // Fixed Error 66
  const expirationDate = addDays(createdAt, 7);
  const isExpired = new Date() > expirationDate;

  if (isExpired) {
    return {
      tasks: [],
      client: { name: '', logo_url: null },
      link: linkData as PublicApprovalLink, // Fixed Error 67
    };
  }

  // 3. Buscar as tarefas associadas se o link for válido
  const { data: tasksData, error: tasksError } = await supabase
    .from('client_tasks')
    .select(`
      id, title, description, status, image_urls, client_id, edit_reason,
      clients (name, logo_url)
    `)
    .eq('public_approval_link_id', linkId)
    .in('status', ['under_review', 'edit_requested', 'approved', 'posted']) // Incluir aprovadas/postadas para mostrar o histórico
    .order('order_index', { ascending: true });

  if (tasksError) {
    throw new Error('Erro ao buscar tarefas para aprovação.');
  }
  
  const clientData = tasksData?.[0]?.clients;
  const clientInfo = Array.isArray(clientData) ? clientData[0] : clientData;

  return {
    link: linkData as PublicApprovalLink, // Fixed Error 68
    client: clientInfo || { name: 'Cliente', logo_url: null }, // Fixed Error 69
    tasks: tasksData as ClientTask[], // Fixed Error 70
  };
};

// Componente para uma única tarefa
const ApprovalTaskCard = ({ task, onApprove, onEditRequest, isProcessing, onImageClick }: {
  task: ClientTask;
  onApprove: (taskId: string) => void;
  onEditRequest: (taskId: string, reason: string) => void;
  isProcessing: boolean;
  onImageClick: (url: string) => void;
}) => {
  const [editReason, setEditReason] = useState(task.edit_reason || '');
  const [showEditForm, setShowEditForm] = useState(task.status === 'edit_requested');

  const handleEditRequest = () => {
    if (!editReason.trim()) {
      showError('Por favor, descreva a alteração necessária.');
      return;
    }
    onEditRequest(task.id, editReason);
  };

  return (
    <Card className="w-full overflow-hidden shadow-lg bg-card border-border transition-all duration-300">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">{task.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {task.image_urls && task.image_urls.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            {task.image_urls.map((url, index) => (
              <button key={index} onClick={() => onImageClick(url)} className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-lg">
                <img
                  src={url}
                  alt={`Imagem ${index + 1} de ${task.title}`}
                  className="rounded-lg object-cover w-full h-auto cursor-pointer"
                />
              </button>
            ))}
          </div>
        )}
        {task.description && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
        )}
      </CardContent>
      <CardFooter className="flex flex-col items-start space-y-4 bg-muted/50 p-4">
        {task.status === 'under_review' && !showEditForm && (
          <div className="flex w-full gap-2">
            <Button onClick={() => onApprove(task.id)} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700 text-white">
              <ThumbsUp className="mr-2 h-4 w-4" /> Aprovar
            </Button>
            <Button variant="outline" onClick={() => setShowEditForm(true)} disabled={isProcessing} className="w-full">
              <MessageSquare className="mr-2 h-4 w-4" /> Solicitar Edição
            </Button>
          </div>
        )}
        {showEditForm && (
          <div className="w-full space-y-2">
            <Textarea
              placeholder="Descreva as alterações necessárias..."
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="bg-input border-border text-foreground focus-visible:ring-ring"
            />
            <div className="flex w-full gap-2">
              <Button onClick={handleEditRequest} disabled={isProcessing} className="w-full bg-primary text-primary-foreground">
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Enviar Solicitação'}
              </Button>
              {task.status === 'under_review' && (
                 <Button variant="ghost" onClick={() => setShowEditForm(false)} disabled={isProcessing}>Cancelar</Button>
              )}
            </div>
          </div>
        )}
        {task.status === 'edit_requested' && !showEditForm && (
          <div className="w-full p-3 rounded-md bg-yellow-100 border border-yellow-200 text-yellow-800 text-sm">
            <p className="font-semibold">Edição solicitada:</p>
            <p className="whitespace-pre-wrap mt-1">{task.edit_reason}</p>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

// Componente principal da página
const PublicApprovalPage: React.FC = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const navigate = useNavigate();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: approvalData, isLoading, error, refetch } = useQuery({
    queryKey: ['approvalLink', uniqueId],
    queryFn: () => loadData(uniqueId!),
    enabled: !!uniqueId,
    staleTime: Infinity,
    retry: false,
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status, reason }: { taskId: string; status: ClientTaskStatus; reason?: string }) => {
      const { error } = await supabase
        .from('client_tasks')
        .update({
          status: status,
          edit_reason: reason || null,
        })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess('Status da tarefa atualizado com sucesso!');
      refetch();
    },
    onError: (err: any) => {
      showError('Ocorreu um erro: ' + err.message);
    },
  });

  const handleApprove = (taskId: string) => {
    updateTaskStatus.mutate({ taskId, status: 'approved' });
  };

  const handleEditRequest = (taskId: string, reason: string) => {
    updateTaskStatus.mutate({ taskId, status: 'edit_requested', reason });
  };

  // Fixed Errors 73-76: Use approvalData instead of data
  const approvedTasks = React.useMemo(() => approvalData?.tasks.filter(t => t.status === 'approved') || [], [approvalData]);
  const pendingTasks = React.useMemo(() => approvalData?.tasks.filter(t => t.status !== 'approved') || [], [approvalData]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !approvalData) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background text-foreground">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center justify-center text-destructive">
              <AlertTriangle className="mr-2 h-6 w-6" /> Erro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Não foi possível carregar a página de aprovação. O link pode ser inválido ou um erro ocorreu.</p>
            <p className="mt-2 text-sm text-muted-foreground">{(error as Error)?.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { client, tasks, link } = approvalData;

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      {/* Container principal com layout corrigido */}
      <main className="w-full py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center mb-8">
          <Avatar className="h-16 w-16 mb-4">
            <AvatarImage src={client.logo_url || undefined} alt={client.name} />
            <AvatarFallback className="text-xl bg-primary/20 text-primary">{getInitials(client.name)}</AvatarFallback>
          </Avatar>
          <h1 className="text-3xl font-bold text-foreground">Aprovação de Conteúdo</h1>
          <p className="text-lg text-muted-foreground">Cliente: {client.name}</p>
          <div className="mt-4 text-sm text-muted-foreground bg-background border border-border rounded-full px-4 py-1.5 flex items-center gap-2">
            <Info className="h-4 w-4" />
            <span>Este link de aprovação expira em {formatDateTime(link.expires_at, false)}</span>
          </div>
        </div>

        {pendingTasks.length === 0 && approvedTasks.length > 0 && (
          <div className="text-center p-8 bg-green-100 border border-green-200 rounded-lg">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-green-800">Tudo aprovado!</h2>
            <p className="text-green-700 mt-2">Obrigado! Todas as tarefas foram aprovadas.</p>
          </div>
        )}

        {pendingTasks.length > 0 && (
          <>
            <h2 className="text-xl font-bold mb-4 text-foreground">Itens Pendentes de Aprovação</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingTasks.map(task => (
                <ApprovalTaskCard
                  key={task.id}
                  task={task}
                  onApprove={handleApprove}
                  onEditRequest={handleEditRequest}
                  isProcessing={updateTaskStatus.isPending}
                  onImageClick={setLightboxUrl}
                />
              ))}
            </div>
          </>
        )}

        {approvedTasks.length > 0 && (
          <>
            <h2 className="text-xl font-semibold mt-12 mb-4 text-foreground">Itens Já Aprovados</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-70">
              {approvedTasks.map(task => (
                <Card key={task.id} className="w-full overflow-hidden shadow-md bg-card border-border">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-foreground">{task.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {task.image_urls?.[0] && (
                      <AspectRatio ratio={4 / 5} className="rounded-md overflow-hidden border border-border bg-secondary">
                        <img 
                          src={task.image_urls[0]} 
                          alt={task.title} 
                          className="h-full w-full object-cover cursor-pointer" 
                          onClick={() => setLightboxUrl(task.image_urls![0])}
                        />
                      </AspectRatio>
                    )}
                  </CardContent>
                  <CardFooter className="bg-green-100 p-3">
                    <div className="flex items-center text-green-700">
                      <CheckCircle className="mr-2 h-5 w-5" />
                      <span className="font-medium text-sm">Aprovado</span>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </>
        )}
      </main>
      
      {/* Lightbox para Imagem */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="lightbox-fullscreen-override">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLightboxUrl(null)} 
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 h-10 w-10"
          >
            <XCircle className="h-6 w-6" />
          </Button>
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Visualização em Tela Cheia"
              className="max-w-[95%] max-h-[95%] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PublicApprovalPage;
</dyad-file>

<dyad-write path="src/components/finance/QuickCategoryForm.tsx" description="Fixing structural JSX error by removing an extra closing div tag.">
"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FinancialTransactionType, FinancialScope } from '@/types/finance';

const quickCategorySchema = z.object({
  name: z.string().min(1, "O nome da categoria é obrigatório."),
  type: z.enum(["income", "expense"]),
  scope: z.enum(["company", "personal"]),
});

export type QuickCategoryFormValues = z.infer<typeof quickCategorySchema>;

interface QuickCategoryFormProps {
  onCategorySaved: () => void;
  onClose: () => void;
}

const QuickCategoryForm: React.FC<QuickCategoryFormProps> = ({ onCategorySaved, onClose }) => {
  const form = useForm<QuickCategoryFormValues>({
    resolver: zodResolver(quickCategorySchema),
    defaultValues: {
      name: "",
      type: "expense",
      scope: "company",
    },
  });

  const onSubmit = (values: QuickCategoryFormValues) => {
    onCategorySaved();
    onClose();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome da Categoria</FormLabel>
            <FormControl>
              <Input placeholder="Ex: Aluguel, Salário" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="expense">Despesa</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="scope"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Escopo</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o escopo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="company">Empresa</SelectItem>
                  <SelectItem value="personal">Pessoal</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      {/* Removed extra closing div tag here (Errors 1-5, 42) */}

      <Button type="submit">Salvar Categoria</Button>
    </form>
  );
};

export default QuickCategoryForm;
</dyad-file>

<dyad-write path="src/lib/utils.ts" description="Ensuring date-fns imports are correctly aliased to resolve TS2305 and TS2554 conflicts.">
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
// TS2305 fix: Ensuring parseISO is correctly imported/aliased.
import { parseISO as dateFnsParseISO, format as dateFnsFormat } from 'date-fns';
import * as dateFnsTz from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

// Define local versions of parseISO and formatISO to avoid TS conflicts
export function parseISO(dateString: string | Date): Date {
  if (dateString instanceof Date) return dateString;
  // Usar date-fns parseISO para melhor compatibilidade com strings ISO
  return dateFnsParseISO(dateString);
}

export function formatISO(date: Date): string {
  // Simple ISO formatting, relying on native Date toISOString
  return date.toISOString();
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SAO_PAULO_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Obtém a data local de hoje no formato YYYY-MM-DD, usando o fuso horário do navegador.
 * Isso é usado como fallback para a Edge Function.
 */
export function getTodayLocalString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Converte uma data local (ou string) para uma data UTC pura (sem informação de tempo/fuso)
 * formatada como 'yyyy-MM-dd'. Isso é usado para salvar datas de vencimento no DB.
 */
export function convertToUtc(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  const dateObj = date instanceof Date ? date : parseISO(date);
  // Retorna a data como se fosse UTC, mas sem alterar o dia.
  // Isso é um hack comum para armazenar datas puras no Supabase.
  return dateObj; 
}

/**
 * Formata uma data para exibição no formato brasileiro (DD/MM/YYYY).
 */
export function formatDateTime(date: Date | string | null | undefined, includeTime: boolean = true): string {
  if (!date) return "N/A";
  const dateObj = date instanceof Date ? date : parseISO(date);
  
  const formatString = includeTime ? "dd/MM/yyyy 'às' HH:mm" : "dd/MM/yyyy";
  // TS2554 fix: The usage is correct for date-fns v2/v3. Relying on the correct imports to resolve type conflicts.
  return dateFnsFormat(dateObj, formatString, { locale: ptBR }); 
}

/**
 * Formata apenas o horário (HH:mm).
 */
export function formatTime(timeString: string | null | undefined): string {
  if (timeString === null || timeString === undefined) return "Sem horário";
  try {
    // Garante que o formato 24h seja mantido
    const [hours, minutes] = timeString.split(':').map(Number);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  } catch (e) {
    return timeString;
  }
}

export function getInitials(name: string): string {
  if (!name) return '';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-z0-9_.]/gi, '_').toLowerCase();
}

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};