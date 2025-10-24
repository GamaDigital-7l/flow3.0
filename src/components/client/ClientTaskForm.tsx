"use client";

import React, { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Loader2, Clock, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";
import { convertToUtc, parseISO } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ClientTaskHistory from "./ClientTaskHistory";
import ClientTaskImageManager from "./ClientTaskImageManager"; // Importação do novo componente
import ClientTaskGeneralForm from "./ClientTaskGeneralForm"; // Importação do novo componente

// Tipos simplificados
type ClientTaskStatus = "in_progress" | "under_review" | "approved" | "edit_requested" | "posted";
interface ClientTask {
  id: string;
  title: string;
  description: string | null;
  status: ClientTaskStatus;
  due_date: string | null;
  time: string | null;
  image_urls: string[] | null;
  public_approval_enabled: boolean;
  edit_reason: string | null;
  client_id: string;
  user_id: string;
  is_completed: boolean;
  public_approval_link_id: string | null;
  tags?: { id: string; name: string; color: string }[];
}

const clientTaskSchema = z.object({
  title: z.string().min(1, "O título da tarefa é obrigatório."),
  description: z.string().optional().nullable(),
  due_date: z.date().nullable().optional(),
  time: z.string().optional().nullable(),
  status: z.enum(["in_progress", "under_review", "approved", "edit_requested", "posted"]).default("in_progress"),
  responsible_id: z.string().nullable().optional(),
  selected_tag_ids: z.array(z.string()).optional(),
  image_urls: z.array(z.string()).optional().nullable(), // Gerenciado pelo ImageManager
  public_approval_enabled: z.boolean().default(false),
});

export type ClientTaskFormValues = z.infer<typeof clientTaskSchema>;

interface ClientTaskFormProps {
  clientId: string;
  initialData?: Partial<ClientTaskFormValues & ClientTask> & { id?: string };
  onClientTaskSaved: () => void;
  onClose: () => void;
}

const fetchUsers = async () => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, avatar_url");
  if (error) throw error;
  return data;
};

const ClientTaskForm: React.FC<ClientTaskFormProps> = ({ clientId, initialData, onClientTaskSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>(initialData?.image_urls || []);
  const [publicApprovalLink, setPublicApprovalLink] = useState<string | null>(
    initialData?.public_approval_link_id 
      ? `${window.location.origin}/approval/${initialData.public_approval_link_id}`
      : null
  );
  const [activeTab, setActiveTab] = useState('general');

  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["usersList"],
    queryFn: fetchUsers,
    enabled: !!userId,
  });

  const form = useForm<ClientTaskFormValues>({
    resolver: zodResolver(clientTaskSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || null,
      due_date: initialData?.due_date ? parseISO(initialData.due_date) : null,
      time: initialData?.time || null,
      status: initialData?.status || "in_progress",
      responsible_id: initialData?.responsible_id || null,
      selected_tag_ids: initialData?.tags?.map(tag => tag.id) || [],
      image_urls: initialData?.image_urls || [],
      public_approval_enabled: initialData?.public_approval_enabled || false,
    },
  });

  const onSubmit = async (values: ClientTaskFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    try {
      let clientTaskId: string;
      const isEditing = !!initialData?.id;
      const oldStatus = initialData?.status;
      const newStatus = values.status;

      const dataToSave = {
        client_id: clientId,
        user_id: userId,
        title: values.title,
        description: values.description || null,
        month_year_reference: values.due_date ? format(values.due_date, "yyyy-MM") : format(new Date(), "yyyy-MM"),
        status: newStatus,
        due_date: values.due_date ? format(convertToUtc(values.due_date)!, "yyyy-MM-dd") : null,
        time: values.time || null,
        responsible_id: values.responsible_id || null,
        image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : null, // Usar o estado local
        public_approval_enabled: values.public_approval_enabled,
        updated_at: new Date().toISOString(),
        is_completed: newStatus === 'approved' || newStatus === 'posted',
        completed_at: (newStatus === 'approved' || newStatus === 'posted') ? new Date().toISOString() : null,
        edit_reason: null,
      };

      if (isEditing) {
        const { data, error } = await supabase
          .from("client_tasks")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId)
          .select("id, public_approval_link_id")
          .single();

        if (error) throw error;
        clientTaskId = data.id;
        showSuccess("Tarefa de cliente atualizada com sucesso!");
      } else {
        const { data, error } = await supabase.from("client_tasks").insert(dataToSave).select("id").single();

        if (error) throw error;
        clientTaskId = data.id;
        showSuccess("Tarefa de cliente adicionada com sucesso!");
      }

      // Handle tags
      await supabase.from("client_task_tags").delete().eq("client_task_id", clientTaskId);

      if (values.selected_tag_ids && values.selected_tag_ids.length > 0) {
        const taskTagsToInsert = values.selected_tag_ids.map(tagId => ({
          client_task_id: clientTaskId,
          tag_id: tagId,
        }));
        const { error: tagInsertError } = await supabase.from("client_task_tags").insert(taskTagsToInsert);
        if (tagInsertError) throw tagInsertError;
      }
      
      // 5. Registrar histórico
      if (!isEditing) {
        await supabase.from('client_task_history').insert({
          client_task_id: clientTaskId,
          user_id: userId,
          event_type: 'created',
          details: { status: newStatus },
        });
      } else if (oldStatus !== newStatus) {
        await supabase.from('client_task_history').insert({
          client_task_id: clientTaskId,
          user_id: userId,
          event_type: 'status_changed',
          details: { old_status: oldStatus, new_status: newStatus },
        });
      } else {
        await supabase.from('client_task_history').insert({
          client_task_id: clientTaskId,
          user_id: userId,
          event_type: 'updated',
          details: { fields: Object.keys(values).filter(key => (form.formState.dirtyFields as any)[key]) },
        });
      }


      // Generate public approval link if enabled
      if (values.public_approval_enabled) {
        const monthYearRef = dataToSave.month_year_reference;
        
        if (!initialData?.public_approval_link_id) {
            const { data: fnData, error: fnError } = await supabase.functions.invoke('generate-approval-link', {
              body: {
                clientId: clientId,
                monthYearRef: monthYearRef,
                userId: userId,
              },
            });

            if (fnError) {
              console.error("Erro ao gerar link de aprovação:", fnError);
              showError("Erro ao gerar link de aprovação: " + fnError.message);
            } else {
              const uniqueId = (fnData as any).uniqueId;
              const publicLink = `${window.location.origin}/approval/${uniqueId}`;
              setPublicApprovalLink(publicLink);

              const { error: updateTaskError } = await supabase
                .from("client_tasks")
                .update({ public_approval_link_id: uniqueId })
                .eq("id", clientTaskId);

              if (updateTaskError) {
                console.error("Erro ao atualizar tarefa com link de aprovação:", updateTaskError);
                showError("Erro ao atualizar tarefa com link de aprovação: " + updateTaskError.message);
              } else {
                showSuccess("Link de aprovação gerado e associado à tarefa!");
              }
            }
        } else {
            const publicLink = `${window.location.origin}/approval/${initialData.public_approval_link_id}`;
            setPublicApprovalLink(publicLink);
        }
      } else {
        setPublicApprovalLink(null);
      }

      form.reset(values);
      onClientTaskSaved();
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
    } catch (error: any) {
      showError("Erro ao salvar tarefa de cliente: " + error.message);
      console.error("Erro ao salvar tarefa de cliente:", error);
    }
  };

  return (
    <FormProvider {...form}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted text-muted-foreground">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="history" disabled={!initialData?.id}>
            <Clock className="mr-2 h-4 w-4" /> Histórico
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="mt-4">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-0 bg-card rounded-xl frosted-glass card-hover-effect">
            
            <ClientTaskGeneralForm 
              users={users} 
              isLoadingUsers={isLoadingUsers} 
              publicApprovalLink={publicApprovalLink}
            />

            <ClientTaskImageManager
              clientId={clientId}
              userId={userId!}
              uploadedImageUrls={uploadedImageUrls}
              setUploadedImageUrls={setUploadedImageUrls}
            />

            <Button 
              type="submit" 
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90" 
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData?.id ? "Atualizar Tarefa" : "Adicionar Tarefa")}
            </Button>
          </form>
        </TabsContent>
        
        <TabsContent value="history" className="mt-4">
          {initialData?.id ? (
            <ClientTaskHistory clientTaskId={initialData.id} />
          ) : (
            <p className="text-muted-foreground p-4">O histórico estará disponível após a criação da tarefa.</p>
          )}
        </TabsContent>
      </Tabs>
    </FormProvider>
  );
};

export default ClientTaskForm;