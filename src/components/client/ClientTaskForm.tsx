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
import { CalendarIcon, Loader2, XCircle, Image as ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { cn, parseISO, sanitizeFilename, convertToUtc, formatDateTime } from "@/lib/utils"; // Importando parseISO, sanitizeFilename, convertToUtc de utils
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient, useQuery } from "@tanstack/react-query"; // Adicionado useQuery
import { ClientTask, ClientTaskStatus } from "@/types/client";
import TagSelector from "../TagSelector";
import { Checkbox } from "../ui/checkbox";
import { ptBR } from "date-fns/locale/pt-BR";
import TimePicker from "../TimePicker";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"; // Adicionado Form components
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Adicionado Select components

const clientTaskSchema = z.object({
  title: z.string().min(1, "O título da tarefa é obrigatório."),
  description: z.string().optional().nullable(),
  due_date: z.date().nullable().optional(),
  time: z.string().optional().nullable(),
  status: z.enum(["pending", "in_progress", "under_review", "approved", "rejected", "completed", "edit_requested", "posted"]).default("pending"),
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
      status: initialData?.status || "pending",
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

      const dataToSave = {
        client_id: clientId,
        user_id: userId,
        title: values.title,
        description: values.description || null,
        month_year_reference: format(values.due_date || new Date(), "yyyy-MM"),
        status: values.status,
        due_date: values.due_date ? format(convertToUtc(values.due_date)!, "yyyy-MM-dd") : null,
        time: values.time || null,
        responsible_id: values.responsible_id || null,
        image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : null,
        public_approval_enabled: values.public_approval_enabled,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { data, error } = await supabase
          .from("client_tasks")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId)
          .select("id")
          .single();

        if (error) throw error;
        clientTaskId = data.id;
        showSuccess("Tarefa de cliente atualizada com sucesso!");
      } else {
        const { data, error } = await supabase.from("client_tasks").insert({
          ...dataToSave,
          is_completed: false,
          order_index: 0, // Deve ser ajustado pelo DND
        }).select("id").single();

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

      form.reset();
      onClientTaskSaved();
      onClose();
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
    } catch (error: any) {
      showError("Erro ao salvar tarefa de cliente: " + error.message);
      console.error("Erro ao salvar tarefa de cliente:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-card rounded-xl frosted-glass card-hover-effect">
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
              <FormLabel>Descrição (Opcional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Detalhes da entrega..." {...field} value={field.value || ''} />
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
                          format(field.value, "PPP", { locale: ptBR })
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
                    <SelectItem value="pending">A Fazer</SelectItem>
                    <SelectItem value="in_progress">Em Produção</SelectItem>
                    <SelectItem value="under_review">Para Aprovação</SelectItem>
                    <SelectItem value="approved">Aprovado</SelectItem>
                    <SelectItem value="posted">Postado</SelectItem>
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
          <Label>Imagens/Anexos (Opcional)</Label>
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
                <img src={url} alt={`Anexo ${index + 1}`} className="h-full w-full object-cover" />
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

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={form.formState.isSubmitting || isUploading}>
          {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData?.id ? "Atualizar Tarefa" : "Adicionar Tarefa")}
        </Button>
      </form>
    </Form>
  );
};

export default ClientTaskForm;