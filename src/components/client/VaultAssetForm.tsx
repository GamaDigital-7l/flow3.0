"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, File, Lock, Palette, Type, Upload, XCircle, Copy } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient } from "@tanstack/react-query";
import { AssetType, VaultAsset, ASSET_TYPE_LABELS } from "@/types/vault";
import { useVaultEncryption } from "@/hooks/useVaultEncryption";
import { cn, sanitizeFilename } from "@/lib/utils";

const assetSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório."),
  description: z.string().nullable().optional(),
  asset_type: z.enum(['file', 'color_palette', 'font', 'secret']),
  
  // File upload fields
  file: z.any().optional(),
  
  // Secret fields
  secret_value: z.string().optional(),
  
  // Color Palette fields
  color_hex: z.string().optional(),
  
  // Font fields
  font_name: z.string().optional(),
  preview_text: z.string().optional(),
});

export type VaultAssetFormValues = z.infer<typeof assetSchema>;

interface VaultAssetFormProps {
  clientId: string;
  initialData?: VaultAsset;
  onAssetSaved: () => void;
  onClose: () => void;
}

const VaultAssetForm: React.FC<VaultAssetFormProps> = ({ clientId, initialData, onAssetSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const { mutateAsync: encryptDecrypt, isPending: isEncrypting } = useVaultEncryption();

  const isEditing = !!initialData;
  const [isUploading, setIsUploading] = useState(false);
  const [decryptedSecret, setDecryptedSecret] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const form = useForm<VaultAssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || null,
      asset_type: initialData?.asset_type || 'file',
      
      // Initialize specific fields based on asset type
      secret_value: undefined,
      color_hex: initialData?.asset_type === 'color_palette' ? initialData.metadata?.hex : '#ED1857',
      font_name: initialData?.asset_type === 'font' ? initialData.metadata?.font_name : '',
      preview_text: initialData?.asset_type === 'font' ? initialData.metadata?.preview_text : 'Amostra de Texto',
    },
  });
  
  const assetType = form.watch('asset_type');

  // Efeito para descriptografar o segredo ao editar
  useEffect(() => {
    if (isEditing && initialData?.asset_type === 'secret' && initialData.encrypted_secret && !decryptedSecret) {
      const decryptSecret = async () => {
        setIsDecrypting(true);
        try {
          const result = await encryptDecrypt({ action: 'decrypt', encryptedSecret: initialData.encrypted_secret! });
          setDecryptedSecret(result.secret || null);
          form.setValue('secret_value', result.secret || '');
        } catch (e) {
          showError("Falha ao descriptografar o segredo.");
        } finally {
          setIsDecrypting(false);
        }
      };
      decryptSecret();
    }
  }, [isEditing, initialData, encryptDecrypt, decryptedSecret, form]);

  const handleFileUpload = async (file: File): Promise<{ url: string, mimeType: string }> => {
    const sanitizedFilename = sanitizeFilename(file.name);
    const filePath = `client_vault/${userId}/${clientId}/${Date.now()}-${sanitizedFilename}`;

    const { error: uploadError } = await supabase.storage
      .from("client-assets")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw new Error("Erro ao fazer upload do arquivo: " + uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from("client-assets")
      .getPublicUrl(filePath);

    return { url: publicUrlData.publicUrl, mimeType: file.type };
  };

  const onSubmit = async (values: VaultAssetFormValues) => {
    if (!userId) {
      showError("Usuário não autenticado.");
      return;
    }

    setIsUploading(true);
    let fileUrl: string | null = initialData?.file_url || null;
    let mimeType: string | null = initialData?.mime_type || null;
    let encryptedSecret: string | null = initialData?.encrypted_secret || null;
    let metadata: any = initialData?.metadata || null;

    try {
      // 1. Handle File Upload
      if (values.asset_type === 'file' && values.file) {
        const uploadResult = await handleFileUpload(values.file);
        fileUrl = uploadResult.url;
        mimeType = uploadResult.mimeType;
      } else if (values.asset_type === 'file' && !isEditing && !values.file) {
        showError("Um arquivo é obrigatório para o tipo Arquivo/Documento.");
        return;
      }

      // 2. Handle Secret Encryption
      if (values.asset_type === 'secret' && values.secret_value) {
        const result = await encryptDecrypt({ action: 'encrypt', secret: values.secret_value });
        encryptedSecret = result.encryptedSecret || null;
      } else if (values.asset_type === 'secret' && !values.secret_value && !isEditing) {
        showError("O valor do segredo é obrigatório.");
        return;
      } else if (values.asset_type === 'secret' && !values.secret_value && isEditing) {
        // Se estiver editando e o campo de valor estiver vazio, mantemos o segredo criptografado existente
        encryptedSecret = initialData?.encrypted_secret || null;
      }

      // 3. Handle Metadata
      if (values.asset_type === 'color_palette' && values.color_hex) {
        metadata = { hex: values.color_hex };
      } else if (values.asset_type === 'font' && values.font_name) {
        metadata = { font_name: values.font_name, preview_text: values.preview_text || 'Amostra' };
      }

      const dataToSave = {
        client_id: clientId,
        user_id: userId,
        name: values.name,
        description: values.description || null,
        asset_type: values.asset_type,
        file_url: values.asset_type === 'file' ? fileUrl : null,
        mime_type: values.asset_type === 'file' ? mimeType : null,
        encrypted_secret: values.asset_type === 'secret' ? encryptedSecret : null,
        metadata: metadata,
        updated_at: new Date().toISOString(),
      };

      if (isEditing) {
        const { error } = await supabase
          .from("client_vault_assets")
          .update(dataToSave)
          .eq("id", initialData.id)
          .eq("user_id", userId);

        if (error) throw error;
        showSuccess("Ativo atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("client_vault_assets").insert(dataToSave);
        if (error) throw error;
        showSuccess("Ativo adicionado ao cofre!");
      }

      queryClient.invalidateQueries({ queryKey: ["clientVaultAssets", clientId, userId] });
      onAssetSaved();
      onClose();
    } catch (error: any) {
      showError("Erro ao salvar ativo: " + error.message);
      console.error("Erro ao salvar ativo:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const renderAssetSpecificFields = () => {
    switch (assetType) {
      case 'file':
        return (
          <FormField
            control={form.control}
            name="file"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Arquivo (Max 10MB)</FormLabel>
                <FormControl>
                  <Input
                    type="file"
                    accept="image/*,application/pdf,video/*"
                    onChange={(e) => field.onChange(e.target.files ? e.target.files[0] : null)}
                    className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                    disabled={isEditing && !!initialData?.file_url}
                  />
                </FormControl>
                {isEditing && initialData?.file_url && <FormDescription className="text-red-500">Para alterar o arquivo, você deve deletar e recriar o ativo.</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case 'secret':
        return (
          <FormField
            control={form.control}
            name="secret_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Segredo/Senha</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder={isEditing ? "Deixe vazio para manter o segredo existente" : "Insira a senha ou chave de API"}
                    className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                    {...field}
                    value={field.value || ''}
                    disabled={isDecrypting}
                  />
                </FormControl>
                {isDecrypting && <FormDescription className="text-primary flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Descriptografando...</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case 'color_palette':
        return (
          <FormField
            control={form.control}
            name="color_hex"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Código HEX da Cor</FormLabel>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    className="h-10 w-10 p-0 border-border rounded-md cursor-pointer"
                    {...field}
                    value={field.value || '#ED1857'}
                  />
                  <Input
                    type="text"
                    placeholder="#ED1857"
                    className="flex-1 bg-input border-border text-foreground focus-visible:ring-ring"
                    {...field}
                    value={field.value || ''}
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        );
      case 'font':
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="font_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Fonte</FormLabel>
                  <FormControl><Input placeholder="Ex: Inter Bold" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="preview_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Texto de Amostra</FormLabel>
                  <FormControl><Input placeholder="Amostra de texto para preview" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            )}
          />
        );
      default:
        return null;
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      
        {/* Tipo de Ativo */}
        <FormField
          control={form.control}
          name="asset_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Ativo</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de ativo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(ASSET_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Nome e Descrição */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome</FormLabel>
              <FormControl><Input placeholder="Ex: Logo Principal, Senha do Instagram" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição Curta (Opcional)</FormLabel>
              <FormControl><Textarea placeholder="Detalhes sobre o ativo..." {...field} value={field.value || ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Campos Específicos do Ativo */}
        {renderAssetSpecificFields()}

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isUploading || isEncrypting || isDecrypting}>
          {isUploading || isEncrypting || isDecrypting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isEditing ? "Atualizar Ativo" : "Adicionar Ativo")}
        </Button>
      </form>
    </Form>
  );
};

export default VaultAssetForm;