"use client";

import React, a useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ClientTask } from "@/types/client";
import { showSuccess, showError } from "@/utils/toast";
import { Loader2, Upload, X, Paperclip } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

const taskSchema = z.object({
  title: z.string().min(1, "O título é obrigatório."),
  description: z.string().optional(),
  due_date: z.string().optional().nullable(),
  time: z.string().optional().nullable(),
});

type TaskFormData = z.infer<typeof taskSchema>;

interface ClientTaskFormProps {
  clientId: string;
  columnStatus: string;
  task?: ClientTask | null;
  onTaskSaved: () => void;
  onClose: () => void;
}

const ClientTaskForm: React.FC<ClientTaskFormProps> = ({
  clientId,
  columnStatus,
  task,
  onTaskSaved,
  onClose,
}) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(task?.image_urls || []);
  const [isUploading, setIsUploading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: task?.title || "",
      description: task?.description || "",
      due_date: task?.due_date ? task.due_date.split('T')[0] : "",
      time: task?.time || "",
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setImageFiles(Array.from(event.target.files));
    }
  };

  const uploadImages = async (taskId: string): Promise<string[]> => {
    if (imageFiles.length === 0) return [];
    setIsUploading(true);

    const uploadPromises = imageFiles.map(async (file) => {
      const filePath = `${userId}/${clientId}/${taskId}/${uuidv4()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('client-assets')
        .upload(filePath, file);

      if (uploadError) {
        throw new Error(`Erro no upload da imagem: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('client-assets')
        .getPublicUrl(filePath);
      
      return publicUrl;
    });

    const urls = await Promise.all(uploadPromises);
    setIsUploading(false);
    return urls;
  };

  const removeExistingImage = async (urlToRemove: string) => {
    setExistingImageUrls(prev => prev.filter(url => url !== urlToRemove));
    
    // Extrai o caminho do arquivo da URL para exclusão no Storage
    const filePath = urlToRemove.split('/client-assets/')[1];
    if (filePath) {
      await supabase.storage.from('client-assets').remove([filePath]);
    }
  };

  const onSubmit = async (formData: TaskFormData) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }
    setIsSubmitting(true);

    try {
      let finalImageUrls = [...existingImageUrls];
      let taskId = task?.id;

      // Se for uma nova tarefa, precisamos de um ID antes de fazer o upload
      if (!taskId) {
        const tempTaskData = {
          ...formData,
          client_id: clientId,
          user_id: userId,
          status: columnStatus,
          image_urls: [], // Começa vazio
        };
        const { data: newTask, error } = await supabase
          .from('client_tasks')
          .insert(tempTaskData)
          .select('id')
          .single();
        
        if (error) throw error;
        taskId = newTask.id;
      }

      if (imageFiles.length > 0) {
        const newImageUrls = await uploadImages(taskId);
        finalImageUrls = [...finalImageUrls, ...newImageUrls];
      }

      const taskData = {
        ...formData,
        client_id: clientId,
        user_id: userId,
        status: columnStatus,
        image_urls: finalImageUrls,
      };

      const { error } = await supabase
        .from('client_tasks')
        .update(taskData)
        .eq('id', taskId);

      if (error) throw error;

      showSuccess(`Tarefa ${task ? 'atualizada' : 'criada'} com sucesso!`);
      onTaskSaved();
      onClose();
    } catch (err: any) {
      showError("Erro ao salvar tarefa: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="title">Título da Tarefa</Label>
        <Input id="title" {...register("title")} />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>
      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea id="description" {...register("description")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="due_date">Data de Entrega</Label>
          <Input id="due_date" type="date" {...register("due_date")} />
        </div>
        <div>
          <Label htmlFor="time">Horário</Label>
          <Input id="time" type="time" {...register("time")} />
        </div>
      </div>
      <div>
        <Label htmlFor="images">Imagens</Label>
        <div className="mt-2 flex items-center justify-center w-full">
          <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted hover:bg-muted/80">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
              <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Clique para enviar</span> ou arraste e solte</p>
              <p className="text-xs text-muted-foreground">SVG, PNG, JPG or GIF</p>
            </div>
            <Input id="dropzone-file" type="file" className="hidden" multiple onChange={handleFileChange} />
          </label>
        </div>
        {imageFiles.length > 0 && (
          <div className="mt-2 text-sm text-muted-foreground">
            {imageFiles.length} arquivo(s) selecionado(s).
          </div>
        )}
      </div>

      {existingImageUrls.length > 0 && (
        <div>
          <Label>Imagens Atuais</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {existingImageUrls.map((url) => (
              <div key={url} className="relative group">
                <img src={url} alt="Preview" className="w-full h-24 object-cover rounded-md" />
                <button
                  type="button"
                  onClick={() => removeExistingImage(url)}
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting || isUploading}>
          {(isSubmitting || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isUploading ? 'Enviando...' : (task ? 'Salvar Alterações' : 'Criar Tarefa')}
        </Button>
      </div>
    </form>
  );
};

export default ClientTaskForm;