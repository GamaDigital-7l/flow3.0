import React from "react";
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
import { parseISO } from 'date-fns';
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { ClientTask, ClientTaskStatus } from "@/types/client";
import TagSelector from "../TagSelector";
import { Checkbox } from "../ui/checkbox";
import { ptBR } from "date-fns/locale/pt-BR";
import TimePicker from "../TimePicker";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const clientTaskSchema = z.object({
  title: z.string().min(1, "O título da tarefa é obrigatório."),
  description: z.string().optional().nullable(),
  due_date: z.date().optional().nullable(),
  time: z.string().optional().nullable(),
  status: z.enum(["pending", "in_progress", "under_review", "approved", "rejected", "completed", "edit_requested", "posted"]).default("pending"),
  selected_tag_ids: z.array(z.string()).optional(),
});

export type ClientTaskFormValues = z.infer<typeof clientTaskSchema>;

interface ClientTaskFormProps {
  clientId: string;
  initialData?: ClientTask & { selected_tag_ids?: string[] };
  onClientTaskSaved: () => void;
  onClose: () => void;
}

const ClientTaskForm: React.FC<ClientTaskFormProps> = ({ clientId, initialData, onClientTaskSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(initialData?.image_urls || []);

  const form = useForm<ClientTaskFormValues>({
    resolver: zodResolver(clientTaskSchema),
    defaultValues: {
      title: initialData?.title || "",
      description: initialData?.description || null,
      due_date: initialData?.due_date ? parseISO(initialData.due_date) : undefined,
      time: initialData?.time || null,
      status: initialData?.status || "pending",
      selected_tag_ids: initialData?.tags?.map(t => t.id) || [],
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => file.size <= MAX_FILE_SIZE);
    if (validFiles.length !== files.length) {
      showError("Alguns arquivos excedem o limite de 5MB e foram ignorados.");
    }
    setImageFiles(prev => [...prev, ...validFiles]);
    e.target.value = ''; // Reset input
  };

  const handleRemoveNewImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingImage = (urlToRemove: string) => {
    setExistingImageUrls(prev => prev.filter(url => url !== urlToRemove));
  };

  const onSubmit = async (values: ClientTaskFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    setIsLoading(true);

    try {
      let uploadedImageUrls = [...existingImageUrls];
      
      // 1. Upload new images
      for (const file of imageFiles) {
        const sanitizedFilename = sanitizeFilename(file.name);
        // Path: client-assets/{userId}/{clientId}/{timestamp}-{fileName}
        const filePath = `${userId}/${clientId}/${Date.now()}-${sanitizedFilename}`;
        
        const { error: uploadError } = await supabase.storage.from('client-assets').upload(filePath, file);
        if (uploadError) throw new Error('Erro no upload da imagem: ' + uploadError.message);
        
        const { data: publicUrlData } = supabase.storage.from('client-assets').getPublicUrl(filePath);
        uploadedImageUrls.push(publicUrlData.publicUrl);
      }

      const dataToSave = {
        title: values.title,
        description: values.description,
        due_date: values.due_date ? format(convertToUtc(values.due_date)!, "yyyy-MM-dd") : null,
        time: values.time,
        status: values.status,
        is_standard_task: true, 
        image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : null,
        updated_at: new Date().toISOString(),
      };

      let clientTaskId = initialData?.id;
      let mainTaskId = initialData?.main_task_id;

      if (initialData) {
        const { error } = await supabase.from("client_tasks").update(dataToSave).eq("id", initialData.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("client_tasks").insert({
          ...dataToSave,
          client_id: clientId,
          user_id: userId,
          month_year_reference: format(new Date(), "yyyy-MM"),
        }).select('id').single();
        if (error) throw error;
        clientTaskId = data.id;
      }

      // Sincronizar com a tarefa principal se for uma tarefa padrão
      const { data: clientData } = await supabase.from('clients').select('name').eq('id', clientId).single();
      const mainTaskPayload = {
        user_id: userId,
        title: `[CLIENTE] ${values.title}`,
        description: values.description,
        due_date: dataToSave.due_date,
        time: dataToSave.time,
        current_board: 'client_tasks' as const,
        origin_board: 'client_tasks' as const,
        client_name: clientData?.name || 'Cliente',
      };

      if (mainTaskId) {
        const { error } = await supabase.from('tasks').update(mainTaskPayload).eq('id', mainTaskId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('tasks').insert(mainTaskPayload).select('id').single();
        if (error) throw error;
        mainTaskId = data.id;
        await supabase.from('client_tasks').update({ main_task_id: mainTaskId }).eq('id', clientTaskId!);
      }

      // Sincronizar Tags
      if (clientTaskId) {
        await supabase.from("client_task_tags").delete().eq("client_task_id", clientTaskId);
        if (values.selected_tag_ids && values.selected_tag_ids.length > 0) {
          const tagsToInsert = values.selected_tag_ids.map(tagId => ({
            client_task_id: clientTaskId,
            tag_id: tagId,
          }));
          await supabase.from("client_task_tags").insert(tagsToInsert);
        }
      }

      showSuccess(`Tarefa ${initialData ? 'atualizada' : 'criada'} com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["clientTasks", clientId, userId] });
      queryClient.invalidateQueries({ queryKey: ["dashboardTasks", "client_tasks", userId] });
      onClientTaskSaved();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input id="title" {...form.register("title")} placeholder="Ex: Post sobre Lançamento de Produto" />
        {form.formState.errors.title && <p className="text-red-500 text-sm">{form.formState.errors.title.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Descrição (Links, etc.)</Label>
        <Textarea id="description" {...form.register("description")} placeholder="Detalhes da tarefa, links importantes, etc..." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data de Vencimento</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.watch("due_date") && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {form.watch("due_date") ? formatDateTime(form.watch("due_date"), false) : <span>Escolha uma data</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={form.watch("due_date") || undefined} onSelect={(date) => form.setValue("due_date", date)} initialFocus />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Horário (Opcional)</Label>
          <TimePicker
            value={form.watch("time")}
            onChange={(time) => form.setValue("time", time)}
          />
        </div>
      </div>
      <TagSelector selectedTagIds={form.watch("selected_tag_ids") || []} onTagSelectionChange={(ids) => form.setValue("selected_tag_ids", ids)} />
      <div className="space-y-2">
        <Label>Imagens</Label>
        <div className="p-4 border-2 border-dashed rounded-lg text-center">
          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          <Label htmlFor="image-upload" className="mt-2 block text-sm font-medium text-primary cursor-pointer">
            Clique para fazer upload
            <Input id="image-upload" type="file" multiple accept="image/*" className="sr-only" onChange={handleFileChange} />
          </Label>
          <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP até 5MB.</p>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {existingImageUrls.map((url, index) => (
            <div key={index} className="relative">
              <img src={url} alt="Preview" className="h-20 w-full object-cover rounded-md" />
              <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5" onClick={() => handleRemoveExistingImage(url)}>
                <XCircle className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {imageFiles.map((file, index) => (
            <div key={index} className="relative">
              <img src={URL.createObjectURL(file)} alt="Preview" className="h-20 w-full object-cover rounded-md" />
              <Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5" onClick={() => handleRemoveNewImage(index)}>
                <XCircle className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData ? "Salvar Alterações" : "Criar Tarefa")}
      </Button>
    </form>
  );
};

export default ClientTaskForm;