"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, XCircle, Copy, Eye, EyeOff } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { cn, sanitizeFilename } from "@/lib/utils";
import { VaultAsset, AssetType, ASSET_TYPE_LABELS, ColorMetadata, FontMetadata } from "@/types/vault";
import { useVaultEncryption } from "@/hooks/useVaultEncryption";
import copy from "copy-to-clipboard";

// --- Schemas ---

const colorMetadataSchema = z.object({
  hex: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "HEX inválido.").default("#000000"),
  rgb: z.string().optional(),
  cmyk: z.string().optional(),
});

const fontMetadataSchema = z.object({
  font_name: z.string().min(1, "Nome da fonte é obrigatório."),
  preview_text: z.string().min(1, "Texto de pré-visualização é obrigatório."),
});

const assetSchema = z.object({
  name: z.string().min(1, "O nome do ativo é obrigatório."),
  description: z.string().nullable().optional(),
  asset_type: z.enum(['file', 'color_palette', 'font', 'secret']),
  
  // File specific
  file_upload: z.any().optional(),
  file_url: z.string().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  
  // Secret specific
  secret_input: z.string().optional(), // Input field for secret
  encrypted_secret: z.string().nullable().optional(),
  
  // Metadata (for colors/fonts)
  metadata: z.any().optional(),
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
  const hasExistingFile = isEditing && !!initialData?.file_url;
  const hasExistingSecret = isEditing && !!initialData?.encrypted_secret;

  const form = useForm<VaultAssetFormValues>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || null,
      asset_type: initialData?.asset_type || 'file',
      
      // File
      file_url: initialData?.file_url || null,
      mime_type: initialData?.mime_type || null,
      file_upload: undefined,
      
      // Secret
      secret_input: hasExistingSecret ? '********' : '', // Placeholder for existing secret
      encrypted_secret: initialData?.encrypted_secret || null,
      
      // Metadata
      metadata: initialData?.metadata || {},
    },
  });

  const currentAssetType = form.watch('asset_type');
  const [isUploading, setIsUploading] = useState(false);
  const [decryptedSecret, setDecryptedSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  // Effect to decrypt secret on load if editing a secret asset
  useEffect(() => {
    if (hasExistingSecret && currentAssetType === 'secret' && !decryptedSecret) {
      // We don't decrypt automatically on load for security, only when user clicks 'view'
    }
  }, [hasExistingSecret, currentAssetType, decryptedSecret]);
  
  const handleDecryptSecret = async () => {
    if (!initialData?.encrypted_secret) return;
    
    if (showSecret && decryptedSecret) {
      setShowSecret(false);
      return;
    }
    
    try {
      const result = await encryptDecrypt({ action: 'decrypt', encryptedSecret: initialData.encrypted_secret! });
      setDecryptedSecret(result.secret || null);
      setShowSecret(true);
      form.setValue('secret_input', result.secret || '', { shouldDirty: false });
    } catch (e) {
      showError("Falha ao descriptografar o segredo.");
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("file_upload", file);
      form.setValue("mime_type", file.type);
    } else {
      form.setValue("file_upload", undefined);
      form.setValue("mime_type", null);
    }
  };

  const uploadFile = async (file: File): Promise<{ url: string, mimeType: string }> => {
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

    try {
      let finalFileUrl = values.file_url || null;
      let finalMimeType = values.mime_type || null;
      let finalEncryptedSecret = values.encrypted_secret || null;
      let finalMetadata = values.metadata || null;
      
      // 1. Handle File Upload
      if (values.asset_type === 'file' && values.file_upload) {
        const uploadResult = await uploadFile(values.file_upload, values.file_upload.type);
        finalFileUrl = uploadResult.url;
        finalMimeType = uploadResult.mimeType;
      } else if (values.asset_type === 'file' && !hasExistingFile) {
        // If it's a new file asset but no file is uploaded
        if (!isEditing) {
            showError("Um arquivo é obrigatório para o tipo 'Arquivo/Documento'.");
            setIsUploading(false);
            return;
        }
      }
      
      // 2. Handle Secret Encryption
      if (values.asset_type === 'secret') {
        const secretToEncrypt = values.secret_input;
        
        if (secretToEncrypt && secretToEncrypt !== '********') {
          const encryptionResult = await encryptDecrypt({ action: 'encrypt', secret: secretToEncrypt });
          finalEncryptedSecret = encryptionResult.encryptedSecret || null;
        } else if (hasExistingSecret && secretToEncrypt === '********') {
          // Keep existing encrypted secret if input wasn't changed
          finalEncryptedSecret = initialData!.encrypted_secret;
        } else {
          // If it's a new secret asset but no secret is provided
          if (!isEditing) {
            showError("O campo de segredo é obrigatório.");
            setIsUploading(false);
            return;
          }
        }
      } else {
        finalEncryptedSecret = null;
      }
      
      // 3. Handle Metadata
      if (values.asset_type === 'color_palette') {
        finalMetadata = { hex: values.metadata.hex };
      } else if (values.asset_type === 'font') {
        finalMetadata = { font_name: values.metadata.font_name, preview_text: values.metadata.preview_text };
      } else {
        finalMetadata = null;
      }

      const dataToSave = {
        client_id: clientId,
        user_id: userId,
        name: values.name,
        description: values.description || null,
        asset_type: values.asset_type,
        
        file_url: finalFileUrl,
        mime_type: finalMimeType,
        encrypted_secret: finalEncryptedSecret,
        metadata: finalMetadata,
        
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
  
  const renderDynamicFields = () => {
    switch (currentAssetType) {
      case 'file':
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="file_upload"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Arquivo ({hasExistingFile ? 'Substituir' : 'Obrigatório'})</FormLabel>
                  <FormControl>
                    <Input
                      type="file"
                      accept="image/*,application/pdf,video/*"
                      onChange={handleFileChange}
                      className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                    />
                  </FormControl>
                  <FormDescription>
                    {hasExistingFile ? `Arquivo existente: ${initialData?.file_url?.split('/').pop()}` : 'Selecione um arquivo para upload.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );
      case 'secret':
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="secret_input"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Segredo/Senha</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showSecret ? 'text' : 'password'}
                        placeholder={hasExistingSecret ? '********' : 'Insira a senha ou chave de acesso'}
                        className="w-full bg-input border-border text-foreground focus-visible:ring-ring pr-10"
                        {...field}
                        value={field.value || ''}
                      />
                    </FormControl>
                    {hasExistingSecret && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleDecryptSecret}
                        className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground"
                        disabled={isEncrypting}
                      >
                        {isEncrypting ? <Loader2 className="h-4 w-4 animate-spin" /> : showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  <FormDescription>
                    {hasExistingSecret ? 'Deixe em branco para manter o segredo existente.' : 'Será criptografado antes de salvar.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );
      case 'color_palette':
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="metadata.hex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cor HEX</FormLabel>
                  <FormControl>
                    <Input
                      type="color"
                      className="w-full h-12 p-1 border-border rounded-md cursor-pointer"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="metadata.hex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor HEX</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="#ED1857"
                      className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );
      case 'font':
        return (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="metadata.font_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Fonte</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Inter Bold"
                      className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="metadata.preview_text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Texto de Pré-visualização</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="A B C 1 2 3"
                      className="w-full bg-input border-border text-foreground focus-visible:ring-ring"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4 bg-card rounded-xl">
        
        {/* Tipo de Ativo */}
        <FormField
          control={form.control}
          name="asset_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Ativo</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(ASSET_TYPE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
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
              <FormControl><Input placeholder="Ex: Logo Principal" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição (Opcional)</FormLabel>
              <FormControl><Textarea placeholder="Detalhes sobre o ativo..." {...field} value={field.value || ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Campos Dinâmicos */}
        {renderDynamicFields()}

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={isUploading || form.formState.isSubmitting || isEncrypting}>
          {isUploading || form.formState.isSubmitting || isEncrypting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isEditing ? "Atualizar Ativo" : "Adicionar Ativo")}
        </Button>
      </form>
    </Form>
  );
};

export default VaultAssetForm;