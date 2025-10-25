"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Edit, Trash2, FileText, Lock, Palette, Type, Download, Copy, Eye, EyeOff, Loader2, Link as LinkIcon } from 'lucide-react';
import { VaultAsset, ASSET_TYPE_LABELS, AssetType } from '@/types/vault';
import { cn } from '@/lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useSession } from '@/integrations/supabase/auth';
import { useVaultEncryption } from '@/hooks/useVaultEncryption';
import { AspectRatio } from '@/components/ui/aspect-ratio';

interface VaultAssetCardProps {
  asset: VaultAsset;
  onEdit: (asset: VaultAsset) => void;
  refetchAssets: () => void;
  onImageClick: (url: string) => void;
}

const getAssetIcon = (assetType: AssetType) => {
  switch (assetType) {
    case 'file': return <FileText className="h-6 w-6 text-blue-500" />;
    case 'color_palette': return <Palette className="h-6 w-6 text-primary" />;
    case 'font': return <Type className="h-6 w-6 text-green-500" />;
    case 'secret': return <Lock className="h-6 w-6 text-red-500" />;
    default: return <FileText className="h-6 w-6 text-muted-foreground" />;
  }
};

const VaultAssetCard: React.FC<VaultAssetCardProps> = React.memo(({ asset, onEdit, refetchAssets, onImageClick }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const { mutateAsync: encryptDecrypt, isPending: isEncrypting } = useVaultEncryption();

  const [decryptedSecret, setDecryptedSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  const handleDeleteAsset = useMutation({
    mutationFn: async (assetId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      // TODO: Implementar exclusão do arquivo no Storage se for 'file'
      
      const { error } = await supabase
        .from("client_vault_assets")
        .delete()
        .eq("id", assetId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Ativo deletado com sucesso!");
      refetchAssets();
    },
    onError: (err: any) => {
      showError("Erro ao deletar ativo: " + err.message);
    },
  });
  
  const handleDecryptSecret = async () => {
    if (!asset.encrypted_secret) return;
    
    if (decryptedSecret) {
      setShowSecret(prev => !prev);
      return;
    }
    
    try {
      const result = await encryptDecrypt({ action: 'decrypt', encryptedSecret: asset.encrypted_secret! });
      setDecryptedSecret(result.secret || null);
      setShowSecret(true);
    } catch (e) {
      showError("Falha ao descriptografar o segredo.");
    }
  };
  
  const handleCopy = (text: string) => {
    copy(text);
    showSuccess("Copiado para a área de transferência!");
  };

  const renderPreview = () => {
    switch (asset.asset_type) {
      case 'file':
        if (asset.file_url) {
          const isImage = asset.mime_type?.startsWith('image/');
          const isPdf = asset.mime_type === 'application/pdf';
          
          if (isImage) {
            return (
              <AspectRatio ratio={4 / 3} className="rounded-md overflow-hidden border border-border bg-secondary">
                <img src={asset.file_url} alt={asset.name} className="h-full w-full object-cover" />
              </AspectRatio>
            );
          }
          if (isPdf) {
            return (
              <div className="flex items-center justify-center h-24 bg-red-500/10 rounded-md border border-red-500/30">
                <FileText className="h-8 w-8 text-red-500" />
                <p className="text-sm text-muted-foreground ml-2">Preview PDF indisponível</p>
              </div>
            );
          }
          return (
            <div className="flex items-center justify-center h-24 bg-muted rounded-md border border-border">
              {getAssetIcon(asset.asset_type)}
              <p className="text-sm text-muted-foreground ml-2">{asset.mime_type}</p>
            </div>
          );
        }
        return null;
        
      case 'color_palette':
        const hex = asset.metadata?.hex || '#000000';
        return (
          <div className="flex flex-col gap-2">
            <div className="h-12 w-full rounded-md border border-border" style={{ backgroundColor: hex }}></div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <p>HEX:</p>
              <Button variant="ghost" size="sm" onClick={() => handleCopy(hex)} className="h-6 p-1 text-primary">
                {hex} <Copy className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        );
        
      case 'font':
        const fontName = asset.metadata?.font_name || 'N/A';
        const previewText = asset.metadata?.preview_text || 'Amostra de Texto';
        return (
          <div className="p-3 bg-secondary rounded-md border border-border space-y-1">
            <p className="text-xs font-semibold text-muted-foreground">Fonte: {fontName}</p>
            <p className="text-lg font-bold text-foreground" style={{ fontFamily: fontName }}>{previewText}</p>
          </div>
        );
        
      case 'secret':
        return (
          <div className="p-3 bg-red-500/10 rounded-md border border-red-500/30 space-y-2">
            <p className="text-sm font-semibold text-red-500 flex items-center gap-1">
              <Lock className="h-4 w-4" /> Segredo Criptografado
            </p>
            {showSecret && decryptedSecret ? (
              <div className="flex justify-between items-center bg-card p-2 rounded-md">
                <p className="text-sm font-mono text-foreground truncate">{decryptedSecret}</p>
                <Button variant="ghost" size="icon" onClick={() => handleCopy(decryptedSecret)} className="h-7 w-7 text-primary hover:bg-primary/10 flex-shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Clique em "Visualizar" para descriptografar temporariamente.</p>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <Card className="bg-card border border-border rounded-xl shadow-sm card-hover-effect flex flex-col">
      <CardHeader className="p-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          {getAssetIcon(asset.asset_type)}
          <CardTitle className="text-base font-semibold text-foreground line-clamp-1">{asset.name}</CardTitle>
        </div>
        <CardDescription className="text-xs text-muted-foreground line-clamp-2">{asset.description || ASSET_TYPE_LABELS[asset.asset_type]}</CardDescription>
      </CardHeader>
      
      <CardContent className="flex-grow p-3 pt-0 space-y-3">
        {renderPreview()}
      </CardContent>
      
      <CardFooter className="p-3 pt-0 flex justify-between gap-2 flex-shrink-0 border-t border-border/50">
        {asset.asset_type === 'file' && asset.file_url ? (
          <Button variant="outline" size="sm" asChild className="flex-1 h-8 text-xs">
            <a href={asset.file_url} target="_blank" rel="noopener noreferrer" download>
              <Download className="mr-2 h-3 w-3" /> Download
            </a>
          </Button>
        ) : asset.asset_type === 'secret' ? (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDecryptSecret} 
            className={cn("flex-1 h-8 text-xs", showSecret ? "bg-red-500/10 text-red-500" : "text-primary border-primary")}
            disabled={isEncrypting}
          >
            {isEncrypting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : showSecret ? <EyeOff className="mr-2 h-3 w-3" /> : <Eye className="mr-2 h-3 w-3" />}
            {showSecret ? "Ocultar" : "Visualizar"}
          </Button>
        ) : (
          <div className="flex-1"></div>
        )}
        
        <div className="flex gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => onEdit(asset)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDeleteAsset.mutate(asset.id)} className="h-7 w-7 text-red-500 hover:bg-red-500/10">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
});

export default VaultAssetCard;