"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Loader2, XCircle, Image as ImageIcon, Link as LinkIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn, parseISO, sanitizeFilename, convertToUtc, formatDateTime } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import TagSelector from "../TagSelector";
import { Checkbox } from "../ui/checkbox";
import { ptBR } from "date-fns/locale/pt-BR";
import TimePicker from "../TimePicker";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"; // Importando Tabs
import ClientTaskHistory from "./ClientTaskHistory"; // Importando Histórico

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
  image_files: z.any().optional(), // Para lidar com FileList
  image_urls: z.array(z.string()).optional().nullable(),
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

  const [isUploading, setIsUploading] = useState(false);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>(initialData?.image_urls || []);
  const [publicApprovalLink, setPublicApprovalLink] = useState<string | null>(initialData?.public_approval_link_id || null);
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const uploadPromises = Array.from(files).map(async (file) => {
      const sanitizedFilename = sanitizeFilename(file.name);
      // Usando pasta 'client_tasks' para assets
      const filePath = `client_tasks/${clientId}/${Date.now()}-${sanitizedFilename}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("client-assets")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        throw new Error("Erro ao fazer upload da imagem: " + uploadError.message);
      }

      const { data: publicUrlData } = supabase.storage
        .from("client-assets")
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    });

    try {
      const newUrls = await Promise.all(uploadPromises);
      setUploadedImageUrls(prev => [...prev, ...newUrls]);
      showSuccess(`${newUrls.length} imagem(ns) adicionada(s)!`);
    } catch (err: any) {
      showError("Erro ao fazer upload: " + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input file
    }
  };

  const handleRemoveImage = (urlToRemove: string) => {
    setUploadedImageUrls(prev => prev.filter(url => url !== urlToRemove));
  };

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
        month_year_reference: format(values.due_date || new Date(), "yyyy-MM"),
        status: newStatus,
        due_date: values.due_date ? format(convertToUtc(values.due_date)!, "yyyy-MM-dd") : null,
        time: values.time || null,
        responsible_id: values.responsible_id || null,
        image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : null,
        public_approval_enabled: values.public_approval_enabled,
        updated_at: new Date().toISOString(),
        is_completed: newStatus === 'approved' || newStatus === 'posted',
        completed_at: (newStatus === 'approved' || newStatus === 'posted') ? new Date().toISOString() : null,
        edit_reason: null, // Limpar motivo de edição ao salvar
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
      
      // 5. Registrar histórico de criação/atualização/status
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
        const monthYearRef = format(values.due_date || new Date(), "yyyy-MM");
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

          // Update the client_tasks table with the unique_link_id
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
        setPublicApprovalLink(null);
      }

      form.reset();
      onClientTaskSaved();
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
    } catch (error: any) {
      showError("Erro ao salvar tarefa de cliente: " + error.message);
      console.error("Erro ao salvar tarefa de cliente:", error);
    }
  };

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 bg-muted text-muted-foreground">
        <TabsTrigger value="general">Geral</TabsTrigger>
        <TabsTrigger value="history" disabled={!initialData?.id}>
          <Clock className="mr-2 h-4 w-4" /> Histórico
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="general" className="mt-4">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-0 bg-card rounded-xl frosted-glass card-hover-effect">
          {/* Título */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Título</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Post para Instagram" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Descrição */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição (Legenda)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Detalhes da entrega/legenda..." {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Data e Hora */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data de Vencimento</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal bg-input border-border text-foreground hover:bg-accent hover:text-accent-foreground",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                          {field.value ? (
                            formatDateTime(field.value, false)
                          ) : (
                            <span>Escolha uma data</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover border-border rounded-md shadow-lg">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={field.onChange}
                        initialFocus
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Horário (Opcional)</FormLabel>
                  <FormControl>
                    <TimePicker
                      value={field.value || null}
                      onChange={(time) => field.onChange(time || null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Responsável e Status */}
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="responsible_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável (Opcional)</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                    value={field.value || '__none__'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar responsável" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">Nenhum</SelectItem>
                      {users?.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="in_progress">Em Produção</SelectItem>
                      <SelectItem value="under_review">Para Aprovação</SelectItem>
                      <SelectItem value="approved">Aprovado</SelectItem>
                      <SelectItem value="posted">Postado/Concluído</SelectItem>
                      <SelectItem value="edit_requested">Edição Solicitada</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Tags */}
          <TagSelector
            selectedTagIds={form.watch("selected_tag_ids") || []}
            onTagSelectionChange={(ids) => form.setValue("selected_tag_ids", ids, { shouldDirty: true })}
          />

          {/* Imagens */}
          <div className="space-y-2">
            <Label>Capa/Anexos (Proporção 4:5 para Capa)</Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              disabled={isUploading}
            />
            {isUploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            <div className="flex flex-wrap gap-2 mt-2">
              {uploadedImageUrls.map((url, index) => (
                <div key={index} className="relative h-20 w-20 rounded-md overflow-hidden group">
                  <AspectRatio ratio={4 / 5}>
                    <img src={url} alt={`Anexo ${index + 1}`} className="h-full w-full object-cover" />
                  </AspectRatio>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-0 right-0 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleRemoveImage(url)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Aprovação Pública */}
          <FormField
            control={form.control}
            name="public_approval_enabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-secondary/50">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    className="border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground flex-shrink-0"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>
                    Habilitar Aprovação Pública
                  </FormLabel>
                  <FormDescription className="text-muted-foreground">
                    Permite que o cliente aprove ou solicite edição via link público.
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          {publicApprovalLink && (
            <div className="flex items-center gap-2 p-3 bg-green-100 border border-green-200 rounded-md">
              <LinkIcon className="h-4 w-4 text-green-600" />
              <a href={publicApprovalLink} target="_blank" rel="noopener noreferrer" className="text-sm text-green-700 hover:underline">
                Link de Aprovação Pública: {publicApprovalLink}
              </a>
            </div>
          )}

          <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={form.formState.isSubmitting || isUploading}>
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
  );
};

export default ClientTaskForm;