"use client";

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Search, FileText, Lock, Palette, Type, Link as LinkIcon, Download } from 'lucide-react';
import { showError, showSuccess, showInfo } from '@/utils/toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DIALOG_CONTENT_CLASSNAMES } from '@/lib/constants';
import { VaultAsset, AssetType, ASSET_TYPE_LABELS } from '@/types/vault';
import VaultAssetForm from './VaultAssetForm';
import VaultAssetCard from './VaultAssetCard';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import copy from 'copy-to-clipboard';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface ClientVaultProps {
  clientId: string;
}

const fetchClientVaultAssets = async (clientId: string, userId: string): Promise<VaultAsset[]> => {
  const { data, error } = await supabase
    .from("client_vault_assets")
    .select("*")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .order("asset_type", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data as VaultAsset[] || [];
};

const ClientVault: React.FC<ClientVaultProps> = ({ clientId }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<VaultAsset | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<AssetType | 'all'>('all');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkExpirationDays, setLinkExpirationDays] = useState(7);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const { data: assets, isLoading, error, refetch } = useQuery<VaultAsset[], Error>({
    queryKey: ["clientVaultAssets", clientId, userId],
    queryFn: () => fetchClientVaultAssets(clientId, userId!),
    enabled: !!userId && !!clientId,
    staleTime: 1000 * 60 * 5,
  });

  const handleAssetSaved = () => {
    refetch();
    setIsFormOpen(false);
    setEditingAsset(undefined);
  };

  const handleEditAsset = (asset: VaultAsset) => {
    setEditingAsset(asset);
    setIsFormOpen(true);
  };
  
  const handleImageClick = (url: string) => {
    setLightboxUrl(url);
  };

  const filteredAssets = useMemo(() => {
    if (!assets) return [];
    
    let filtered = assets;

    if (selectedType !== 'all') {
      filtered = filtered.filter(asset => asset.asset_type === selectedType);
    }

    if (searchTerm) {
      filtered = filtered.filter(asset =>
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        asset.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [assets, searchTerm, selectedType]);
  
  const groupedAssets = useMemo(() => {
    const groups: Record<string, VaultAsset[]> = {
      'secret': [],
      'color_palette': [],
      'font': [],
      'file': [],
    };
    
    filteredAssets.forEach(asset => {
      groups[asset.asset_type]?.push(asset);
    });
    
    return groups;
  }, [filteredAssets]);
  
  const handleGenerateSecureLink = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Usuário não autenticado.");
      
      // TODO: Implementar Edge Function para gerar link seguro de download
      // Por enquanto, apenas simula a geração de um link de download para todos os arquivos
      
      const fileAssets = assets?.filter(a => a.asset_type === 'file' && a.file_url) || [];
      if (fileAssets.length === 0) {
        showInfo("Nenhum arquivo para gerar link de download.");
        return;
      }
      
      // Simulação de link seguro (em um ambiente real, isso seria um token JWT)
      const tempLink = `${window.location.origin}/download/secure/${clientId}?expires=${linkExpirationDays}`;
      setGeneratedLink(tempLink);
      setIsLinkModalOpen(true);
    },
    onSuccess: () => {
      showSuccess("Link seguro gerado!");
    },
    onError: (err: any) => {
      showError("Erro ao gerar link seguro: " + err.message);
    },
  });

  const renderAssetGroup = (type: AssetType, title: string, icon: React.ReactNode) => {
    const group = groupedAssets[type];
    if (!group || group.length === 0) return null;
    
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-foreground flex items-center gap-2 border-b border-border pb-2">
          {icon} {title} ({group.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {group.map(asset => (
            <VaultAssetCard 
              key={asset.id} 
              asset={asset} 
              onEdit={handleEditAsset} 
              refetchAssets={refetch} 
              onImageClick={handleImageClick}
            />
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar cofre: " + error.message);
    return <p className="text-red-500">Erro ao carregar cofre.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Lock className="h-6 w-6 text-primary" /> Cofre do Cliente
        </h2>
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={() => handleGenerateSecureLink.mutate()} 
            variant="outline" 
            className="border-green-500 text-green-500 hover:bg-green-500/10"
            disabled={handleGenerateSecureLink.isPending || !assets || assets.filter(a => a.asset_type === 'file').length === 0}
          >
            {handleGenerateSecureLink.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
            Gerar Link Seguro
          </Button>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingAsset(undefined)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Ativo
              </Button>
            </DialogTrigger>
            <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
              <DialogHeader>
                <DialogTitle className="text-foreground">{editingAsset ? "Editar Ativo" : "Adicionar Novo Ativo"}</DialogTitle>
                <DialogDescription>
                  {editingAsset ? "Atualize os detalhes do ativo." : "Adicione um novo arquivo, senha ou informação essencial do cliente."}
                </DialogDescription>
              </DialogHeader>
              <VaultAssetForm
                clientId={clientId}
                initialData={editingAsset}
                onAssetSaved={handleAssetSaved}
                onClose={() => setIsFormOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por nome ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-input border-border text-foreground focus-visible:ring-ring"
          />
        </div>
        <Select onValueChange={(value) => setSelectedType(value as AssetType | 'all')} defaultValue="all">
          <SelectTrigger className="w-full sm:w-auto">
            <SelectValue placeholder="Filtrar por Tipo" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ASSET_TYPE_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grupos de Ativos */}
      <div className="space-y-8">
        {renderAssetGroup('secret', 'Acessos e Senhas', <Lock className="h-6 w-6 text-red-500" />)}
        {renderAssetGroup('color_palette', 'Paleta de Cores', <Palette className="h-6 w-6 text-primary" />)}
        {renderAssetGroup('font', 'Tipografia', <Type className="h-6 w-6 text-green-500" />)}
        {renderAssetGroup('file', 'Arquivos e Documentos', <FileText className="h-6 w-6 text-blue-500" />)}
        
        {filteredAssets.length === 0 && (
          <Card className="bg-card border-dashed border-border shadow-sm p-8 text-center">
            <Lock className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <CardTitle className="text-xl font-semibold text-muted-foreground">Cofre Vazio</CardTitle>
            <CardDescription className="mt-2">Adicione o primeiro ativo essencial para este cliente.</CardDescription>
          </Card>
        )}
      </div>
      
      {/* Modal de Link Seguro */}
      <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Link Seguro de Download</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Compartilhe este link para permitir o download dos arquivos do cliente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Label htmlFor="expiration">Expiração (dias)</Label>
            <Input
              id="expiration"
              type="number"
              min="1"
              max="30"
              value={linkExpirationDays}
              onChange={(e) => setLinkExpirationDays(parseInt(e.target.value))}
              className="bg-input border-border text-foreground focus-visible:ring-ring"
            />
            <Input value={generatedLink || ''} readOnly className="bg-input border-border text-foreground focus-visible:ring-ring" />
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => copy(generatedLink || '')} className="w-1/2 mr-2">
                <Copy className="mr-2 h-4 w-4" /> Copiar Link
              </Button>
              <Button onClick={() => {}} className="w-1/2 bg-green-500 text-white hover:bg-green-700">
                <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientVault;