"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, XCircle, Tag as TagIcon, Link as LinkIcon } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PortfolioProject, PORTFOLIO_CATEGORIES } from "@/types/portfolio";
import { format, parseISO } from "date-fns";
import { cn, sanitizeFilename } from "@/lib/utils";

// Tipos simplificados para evitar dependência de '@/types/client'
interface Client {
  id: string;
  name: string;
}

const projectSchema = z.object({
  title: z.string().min(1, "O título é obrigatório."),
  category: z.enum(PORTFOLIO_CATEGORIES as [string, ...string[]], { required_error: "A categoria é obrigatória." }),
  client_id: z.string().nullable().optional(),
  short_description: z.string().nullable().optional(),
  result_differentiator: z.string().nullable().optional(),
  external_link: z.string().url("Link externo inválido.").nullable().optional().or(z.literal("")),
  tags_input: z.string().optional(), // Campo temporário para tags
  is_public: z.boolean().default(true),
  add_to_proposals: z.boolean().default(false),
  main_cover_file: z.any().optional(), // Para upload
  gallery_files: z.any().optional(), // Para upload de galeria
});

export type PortfolioFormValues = z.infer<typeof projectSchema>;

interface PortfolioFormProps {
  initialData?: PortfolioProject;
  onProjectSaved: () => void;
  onClose: () => void;
}

const fetchClients = async (userId: string): Promise<Client[]> => {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
};

const PortfolioForm: React.FC<PortfolioFormProps> = ({ initialData, onProjectSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isUploading, setIsUploading] = useState(false);
  const [currentTags, setCurrentTags] = useState<string[]>(initialData?.tags || []);
  const [mainCoverUrl, setMainCoverUrl] = useState(initialData?.main_cover_url || null);
  const [galleryUrls, setGalleryUrls] = useState<string[]>(initialData?.gallery_urls || []);

  const { data: clients, isLoading: isLoadingClients } = useQuery({
    queryKey: ["clientsList", userId],
    queryFn: () => fetchClients(userId!),
    enabled: !!userId,
  });

  const form = useForm<PortfolioFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      title: initialData?.title || "",
      category: initialData?.category || PORTFOLIO_CATEGORIES[0],
      client_id: initialData?.client_id || null,
      short_description: initialData?.short_description || null,
      result_differentiator: initialData?.result_differentiator || null,
      external_link: initialData?.external_link || null,
      is_public: initialData?.is_public ?? true,
      add_to_proposals: initialData?.add_to_proposals ?? false,
      tags_input: initialData?.tags?.join(', ') || "",
    },
  });

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
      .replace(/[\s_-]+/g, '-') // Substitui espaços e hífens por um único hífen
      .replace(/^-+|-+$/g, ''); // Remove hífens no início/fim
  };

  const handleTagInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = form.getValues('tags_input')?.trim();
      if (tag && !currentTags.includes(tag)) {
        setCurrentTags(prev => [...prev, tag]);
        form.setValue('tags_input', '');
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setCurrentTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const sanitizedFilename = sanitizeFilename(file.name);
    const filePath = `portfolio/${userId}/${folder}/${Date.now()}-${sanitizedFilename}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("portfolio-assets")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error("Erro ao fazer upload: " + uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from("portfolio-assets")
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await uploadFile(file, 'covers');
      setMainCoverUrl(url);
      showSuccess("Capa principal enviada!");
    } catch (err: any) {
      showError(err.message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(file => uploadFile(file, 'gallery'));
      const newUrls = await Promise.all(uploadPromises);
      setGalleryUrls(prev => [...prev, ...newUrls]);
      showSuccess(`${newUrls.length} item(ns) de galeria adicionado(s)!`);
    } catch (err: any) {
      showError(err.message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeGalleryItem = (urlToRemove: string) => {
    setGalleryUrls(prev => prev.filter(url => url !== urlToRemove));
  };

  const onSubmit = async (values: PortfolioFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    if (!mainCoverUrl) {
      showError("A capa principal é obrigatória.");
      return;
    }

    try {
      const slug = initialData?.slug || generateSlug(values.title);

      const dataToSave = {
        user_id: userId,
        title: values.title,
        slug: slug,
        category: values.category,
        client_id: values.client_id || null,
        short_description: values.short_description || null,
        result_differentiator: values.result_differentiator || null,
        main_cover_url: mainCoverUrl,
        gallery_urls: galleryUrls.length > 0 ? galleryUrls : null,
        tags: currentTags.length > 0 ? currentTags : null,
        external_link: values.external_link || null,
        is_public: values.is_public,
        add_to_proposals: values.add_to_proposals,
        updated_at: new Date().toISOString(),
      };

      if (initialData?.id) {
        const { error } = await supabase
          .from("portfolio_projects")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Projeto atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("portfolio_projects").insert(dataToSave);
        if (error) throw error;
        showSuccess("Projeto adicionado ao portfólio!");
      }

      queryClient.invalidateQueries({ queryKey: ["portfolioProjects", userId] });
      onProjectSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar projeto: " + error.message);
      console.error("Erro ao salvar projeto:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Informações Básicas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Título do Projeto</FormLabel>
                <FormControl><Input placeholder="Ex: Redesign da Marca X" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PORTFOLIO_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="client_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cliente (Opcional)</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                value={field.value || '__none__'}
                disabled={isLoadingClients}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Vincular a um cliente existente" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum Cliente</SelectItem>
                  {clients?.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
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
          name="short_description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição Breve</FormLabel>
              <FormControl><Textarea placeholder="O que foi feito neste projeto?" {...field} value={field.value || ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="result_differentiator"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resultado / Diferencial (Opcional)</FormLabel>
              <FormControl><Textarea placeholder="Ex: Aumentamos a conversão em 30%." {...field} value={field.value || ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Capa Principal */}
        <div className="space-y-2 border-t border-border pt-4">
          <Label>Capa Principal (Imagem/Vídeo)</Label>
          {mainCoverUrl && (
            <div className="relative w-full h-40 rounded-md overflow-hidden">
              <img src={mainCoverUrl} alt="Capa Principal" className="w-full h-full object-cover" />
              <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => setMainCoverUrl(null)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          )}
          <Input type="file" accept="image/*,video/*" onChange={handleCoverUpload} disabled={isUploading || !!mainCoverUrl} />
          {isUploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>

        {/* Galeria */}
        <div className="space-y-2 border-t border-border pt-4">
          <Label>Galeria (Imagens/Vídeos)</Label>
          <Input type="file" accept="image/*,video/*" multiple onChange={handleGalleryUpload} disabled={isUploading} />
          <div className="flex flex-wrap gap-2 mt-2">
            {galleryUrls.map((url, index) => (
              <div key={index} className="relative h-20 w-20 rounded-md overflow-hidden group">
                <img src={url} alt={`Galeria ${index + 1}`} className="h-full w-full object-cover" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-0 right-0 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeGalleryItem(url)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Tags e Link Externo */}
        <div className="space-y-2 border-t border-border pt-4">
          <FormField
            control={form.control}
            name="tags_input"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2"><TagIcon className="h-4 w-4" /> Tags (Separadas por Enter ou Vírgula)</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: branding, webdesign, 2024" {...field} onKeyDown={handleTagInput} />
                </FormControl>
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentTags.map(tag => (
                    <Button key={tag} type="button" variant="secondary" size="sm" onClick={() => removeTag(tag)} className="h-7 text-xs">
                      {tag} <XCircle className="ml-1 h-3 w-3" />
                    </Button>
                  ))}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="external_link"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> Link Externo (Behance, etc.)</FormLabel>
                <FormControl><Input placeholder="https://behance.net/projeto" {...field} value={field.value || ''} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Configurações de Visibilidade */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
          <FormField
            control={form.control}
            name="is_public"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-secondary/50">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Projeto Público</FormLabel>
                  <FormDescription>Permite que o projeto seja visualizado via link público.</FormDescription>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="add_to_proposals"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm bg-secondary/50">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Adicionar a Orçamentos</FormLabel>
                  <FormDescription>Exibir este projeto automaticamente em propostas.</FormDescription>
                </div>
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={form.formState.isSubmitting || isUploading}>
          {form.formState.isSubmitting || isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData ? "Atualizar Projeto" : "Adicionar Projeto")}
        </Button>
      </form>
    </Form>
  );
};

export default PortfolioForm;