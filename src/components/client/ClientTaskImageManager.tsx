"use client";

import React, { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, XCircle } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { sanitizeFilename } from "@/lib/utils";

interface ClientTaskImageManagerProps {
  clientId: string;
  userId: string;
  uploadedImageUrls: string[];
  setUploadedImageUrls: React.Dispatch<React.SetStateAction<string[]>>;
}

const ClientTaskImageManager: React.FC<ClientTaskImageManagerProps> = ({
  clientId,
  userId,
  uploadedImageUrls,
  setUploadedImageUrls,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const { setValue } = useFormContext();

  const uploadFile = async (file: File): Promise<string> => {
    const sanitizedFilename = sanitizeFilename(file.name);
    // Incluindo userId no path para RLS do Storage
    const filePath = `client_tasks/${userId}/${clientId}/${Date.now()}-${sanitizedFilename}`;

    const { error: uploadError } = await supabase.storage
      .from("client-assets")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      if (uploadError.message.includes('new row violates row-level security policy')) {
        throw new Error("Erro de permissão (RLS). Verifique se a política de segurança do bucket 'client-assets' permite uploads para o caminho: " + filePath);
      }
      throw new Error("Erro ao fazer upload da imagem: " + uploadError.message);
    }

    const { data: publicUrlData } = supabase.storage
      .from("client-assets")
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const uploadPromises = Array.from(files).map(file => uploadFile(file));

    try {
      const newUrls = await Promise.all(uploadPromises);
      setUploadedImageUrls(prev => {
        const updatedUrls = [...prev, ...newUrls];
        setValue("image_urls", updatedUrls, { shouldDirty: true });
        return updatedUrls;
      });
      showSuccess(`${newUrls.length} imagem(ns) adicionada(s)!`);
    } catch (err: any) {
      showError("Erro ao fazer upload: " + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = ''; // Reset input file
    }
  };

  const handleRemoveImage = (urlToRemove: string) => {
    setUploadedImageUrls(prev => {
      const updatedUrls = prev.filter(url => url !== urlToRemove);
      setValue("image_urls", updatedUrls, { shouldDirty: true });
      return updatedUrls;
    });
  };

  return (
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
  );
};

export default ClientTaskImageManager;