"use client";

import React, { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Edit, Trash2, Mail, Phone, Info, LayoutDashboard, Link as LinkIcon, Copy, Loader2, Send } from "lucide-react";
import { useSession } from "@/integrations/supabase/auth";
import { Client } from "@/types/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import ClientForm from "@/components/client/ClientForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientKanbanPage from "./ClientKanbanPage";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { useIsMobile } from "@/hooks/use-mobile";
import PageTitle from "@/components/layout/PageTitle";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const fetchClientById = async (clientId: string): Promise<Client | null> => {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data || null;
};

const ClientDetails: React.FC = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { session } = useSession();
  const userId = session?.user?.id;
  const isMobile = useIsMobile();
  const touchStartX = useRef(0);

  const { data: client, isLoading, error, refetch } = useQuery<Client | null, Error>({
    queryKey: ["client", clientId],
    queryFn: () => fetchClientById(clientId!),
    enabled: !!clientId,
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [approvalLink, setApprovalLink] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile) return;
    const touchEndX = e.changedTouches[0].clientX;
    const swipeDistance = touchEndX - touchStartX.current;
    const swipeThreshold = 50;

    if (swipeDistance > swipeThreshold) {
      navigate(-1);
    }
  };

  const handleClientSaved = () => {
    refetch();
    setIsFormOpen(false);
  };

  const handleDeleteClient = async () => {
    if (!userId || !client?.id) {
      showError("Usuário não autenticado ou cliente não encontrado.");
      return;
    }
    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id)
        .eq("user_id", userId);

      if (error) throw error;
      navigate("/clients");
    } catch (err: any) {
      showError("Erro ao deletar cliente: " + err.message);
    } finally {
      setIsDeleteDialogOpen(false);
    }
  };

  const handleGenerateApprovalLink = async () => {
    if (!client) return;
    setIsGeneratingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-approval-link', {
        body: {
          clientId: client.id,
          monthYearRef: format(new Date(), "yyyy-MM"),
        },
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      const fullLink = `${window.location.origin}/approval/${data.uniqueId}`;
      setApprovalLink(fullLink);
      setIsLinkDialogOpen(true);
      showSuccess("Link de aprovação gerado com sucesso!");
    } catch (err: any) {
      showError("Erro ao gerar link de aprovação: " + err.message);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("Copiado para a área de transferência!");
  };

  const shareOnWhatsApp = (link: string) => {
    const message = `Olá! Seus posts estão prontos para aprovação. Por favor, acesse: ${link}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  if (!clientId) {
    return (
      <div className="p-4">
        <PageTitle title="Cliente Não Encontrado" description="O ID do cliente não foi fornecido." />
        <Button onClick={() => navigate("/clients")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-4"><PageTitle title="Carregando Cliente..." /></div>;
  }

  if (error || !client) {
    return (
      <div className="p-4">
        <PageTitle title="Erro ao Carregar Cliente" description={error?.message || "O cliente não foi encontrado."} />
        <Button onClick={() => navigate("/clients")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para Clientes
        </Button>
      </div>
    );
  }

  return (
    <div
      className="flex flex-1 flex-col gap-4 p-3 md:p-4 lg:p-6"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <PageTitle title={client.name}>
        <Button variant="outline" onClick={handleGenerateApprovalLink} disabled={isGeneratingLink}>
          {isGeneratingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
          Gerar Link de Aprovação
        </Button>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button variant="outline"><Edit className="mr-2 h-4 w-4" /> Editar</Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle>Editar Cliente</DialogTitle>
            </DialogHeader>
            <ClientForm initialData={client} onClientSaved={handleClientSaved} onClose={() => setIsFormOpen(false)} />
          </DialogContent>
        </Dialog>
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive"><Trash2 className="mr-2 h-4 w-4" /> Deletar</Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
              <DialogDescription>Tem certeza que deseja deletar "{client.name}"?</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDeleteClient}>Deletar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageTitle>

      <Tabs defaultValue="kanban" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted text-muted-foreground">
          <TabsTrigger value="kanban"><LayoutDashboard className="mr-2 h-4 w-4" />Kanban</TabsTrigger>
          <TabsTrigger value="info"><Info className="mr-2 h-4 w-4" />Informações</TabsTrigger>
        </TabsList>
        <TabsContent value="kanban" className="mt-4">
          <ClientKanbanPage client={client} />
        </TabsContent>
        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Detalhes do Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {client.contact_email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> {client.contact_email}</p>}
              {client.contact_phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> {client.contact_phone}</p>}
              {client.description && <p className="text-muted-foreground">{client.description}</p>}
              <p className="text-sm text-muted-foreground pt-2 border-t">Criado em: {format(new Date(client.created_at), "PPP", { locale: ptBR })}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle>Link de Aprovação Gerado</DialogTitle>
            <DialogDescription>
              Compartilhe este link com seu cliente. Ele é válido por 7 dias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">Olá! Seus posts estão prontos para aprovação. Por favor, acesse: <span className="font-semibold text-foreground break-all">{approvalLink}</span></p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button onClick={() => shareOnWhatsApp(approvalLink || '')} className="w-full bg-green-600 hover:bg-green-700">
                <Send className="mr-2 h-4 w-4" /> Copiar p/ WhatsApp
              </Button>
              <Button variant="secondary" onClick={() => copyToClipboard(approvalLink || '')}>
                <Copy className="mr-2 h-4 w-4" /> Copiar Link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientDetails;