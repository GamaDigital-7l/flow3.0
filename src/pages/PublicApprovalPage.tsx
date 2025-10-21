"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, supabaseUrl } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, CalendarDays, Clock, Info, Link as LinkIcon, Edit } from "lucide-react";
import { ClientTask, PublicApprovalLink, ClientTaskStatus } from "@/types/client";
import { format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import FullScreenImageViewer from "@/components/client/FullScreenImageViewer";
import EditReasonDialog from "@/components/client/EditReasonDialog";
import { cn } from "@/lib/utils";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { AspectRatio } from "@/components/ui/aspect-ratio"; // Importando AspectRatio

interface PublicApprovalPageProps {}

const fetchPublicApprovalLink = async (linkId: string): Promise<PublicApprovalLink | null> => {
  // 1. Fetch the link and the client data
  const { data: linkData, error: linkError } = await supabase
    .from("public_approval_links")
    .select(`
      *,
      client:clients(id, name, logo_url)
    `)
    .eq("unique_id", linkId)
    .gte("expires_at", new Date().toISOString())
    .single();

  if (linkError && linkError.code !== 'PGRST116') {
    throw linkError;
  }

  if (!linkData) {
    return null;
  }

  // 2. Fetch all associated client tasks for the month that are not yet fully completed
  const { data: tasksData, error: tasksError } = await supabase
    .from("client_tasks")
    .select("id, title, description, due_date, time, status, image_urls, edit_reason, is_completed")
    .eq("client_id", linkData.client_id)
    .eq("month_year_reference", linkData.month_year_reference)
    .not("status", "in", "('approved', 'posted', 'completed')"); // Show all tasks that need action

  if (tasksError) {
    throw tasksError;
  }

  // 3. Combine the data
  return {
    ...linkData,
    client_tasks: tasksData || [],
  } as PublicApprovalLink;
};

const PublicApprovalPage: React.FC<PublicApprovalPageProps> = () => {
  const { uniqueId } = useParams<{ uniqueId: string }>();
  const queryClient = useQueryClient();

  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);
  const [viewerDescription, setViewerDescription] = useState<string | null>(null);
  const [isEditReasonDialogOpen, setIsEditReasonDialogOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<ClientTask | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: approvalLink, isLoading, error, refetch } = useQuery<PublicApprovalLink | null, Error>({
    queryKey: ["publicApprovalLink", uniqueId],
    queryFn: () => fetchPublicApprovalLink(uniqueId!),
    enabled: !!uniqueId,
  });

  const handleUpdateStatus = async (taskId: string, newStatus: ClientTaskStatus, reason?: string) => {
    if (!uniqueId) return;
    setIsSubmitting(true);

    try {
      const { error: invokeError } = await supabase.functions.invoke('update-client-task-status-public', {
        body: { uniqueId, taskId, newStatus, editReason: reason },
      });

      if (invokeError) throw invokeError;

      showSuccess(`Tarefa atualizada para ${newStatus.replace('_', ' ')} com sucesso!`);
      refetch();
    } catch (err: any) {
      showError("Erro ao atualizar status da tarefa: " + err.message);
      console.error("Erro ao atualizar status da tarefa:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageClick = (imageUrls: string[], initialIndex: number, description: string | null) => {
    setViewerImages(imageUrls);
    setViewerInitialIndex(initialIndex);
    setViewerDescription(description);
    setIsImageViewerOpen(true);
  };

  const handleRequestEdit = (task: ClientTask) => {
    setTaskToEdit(task);
    setIsEditReasonDialogOpen(true);
  };

  const handleEditReasonSubmit = (reason: string) => {
    if (taskToEdit) {
      handleUpdateStatus(taskToEdit.id, "edit_requested", reason);
    }
    setIsEditReasonDialogOpen(false);
    setTaskToEdit(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <h1 className="text-3xl font-bold ml-4">Carregando Link de Aprovação...</h1>
      </div>
    );
  }

  if (error || !approvalLink) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4">
        <XCircle className="h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-3xl font-bold mb-2">Link Inválido ou Expirado</h1>
        <p className="text-lg text-muted-foreground text-center">
          O link de aprovação que você está tentando acessar é inválido, expirou ou não contém tarefas para revisão.
        </p>
      </div >
    );
  }

  const monthName = format(new Date(`${approvalLink.month_year_reference}-01`), "MMMM yyyy"); // FIX TS2554
  const tasksToReview = approvalLink.client_tasks;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <header className="mb-8 p-4 bg-card border border-border rounded-xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {approvalLink.client?.logo_url && (
            <img src={approvalLink.client.logo_url} alt={`${approvalLink.client.name} Logo`} className="h-12 w-12 object-contain rounded-md" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{approvalLink.client?.name || "Cliente"}</h1>
            <p className="text-lg text-muted-foreground">Revisão de Tarefas: {monthName}</p>
          </div>
        </div>
        <Badge className="bg-primary text-primary-foreground text-sm">Expira em: {format(new Date(approvalLink.expires_at), "PPP")}</Badge> {/* FIX TS2554 */}
      </header>

      <h2 className="text-xl font-bold text-foreground mb-4">Tarefas Pendentes de Ação ({tasksToReview.length})</h2>

      {tasksToReview.length === 0 ? (
        <Card className="bg-card border border-border rounded-xl shadow-sm p-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-3" />
          <p className="text-lg font-semibold text-foreground">Todas as tarefas foram revisadas!</p>
          <p className="text-muted-foreground">Obrigado pela sua aprovação.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tasksToReview.map((task) => (
            <Card key={task.id} className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow">
              {task.image_urls && task.image_urls.length > 0 && (
                <div className="relative w-full rounded-t-xl overflow-hidden cursor-pointer" onClick={() => handleImageClick(task.image_urls!, 0, task.description)}>
                  <AspectRatio ratio={4 / 5} className="bg-muted">
                    <img
                      src={task.image_urls[0]}
                      alt={task.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </AspectRatio>
                  {task.image_urls.length > 1 && (
                    <Badge className="absolute bottom-2 right-2 bg-black/70 text-white text-sm">+{task.image_urls.length - 1}</Badge>
                  )}
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-xl font-semibold text-foreground break-words">{task.title}</CardTitle>
                <CardDescription className="text-muted-foreground break-words">
                  {task.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-3">
                {task.due_date && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-4 w-4 text-primary flex-shrink-0" /> Vencimento: {format(new Date(task.due_date), "PPP")} {/* FIX TS2554 */}
                  </p>
                )}
                {task.status === 'edit_requested' && task.edit_reason && (
                  <div className="p-2 bg-orange-100 border border-orange-200 rounded-md">
                    <p className="text-sm font-semibold text-orange-800">Motivo da Edição Solicitada:</p>
                    <p className="text-xs text-orange-700 break-words">{task.edit_reason}</p>
                  </div>
                )}
                <div className="flex flex-col gap-2 pt-4 border-t border-border">
                  <Button
                    onClick={() => handleUpdateStatus(task.id, "approved")}
                    disabled={isSubmitting}
                    className="w-full bg-green-600 text-white hover:bg-green-700 text-base py-6 shadow-md hover:shadow-lg transition-shadow"
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" /> {isSubmitting ? "Aprovando..." : "Aprovar"}
                  </Button>
                  <Button
                    onClick={() => handleRequestEdit(task)}
                    disabled={isSubmitting}
                    variant="outline"
                    className="w-full border-orange-500 text-orange-500 hover:bg-orange-500/10 text-base py-6"
                  >
                    <Edit className="mr-2 h-5 w-5" /> Solicitar Edição
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EditReasonDialog
        isOpen={isEditReasonDialogOpen}
        onClose={() => setIsEditReasonDialogOpen(false)}
        onSubmit={handleEditReasonSubmit}
        initialReason={taskToEdit?.edit_reason}
      />

      <FullScreenImageViewer
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        imageUrls={viewerImages}
        initialIndex={viewerInitialIndex}
        description={viewerDescription}
      />
    </div>
  );
};

export default PublicApprovalPage;