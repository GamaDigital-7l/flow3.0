export type AssetType = 'file' | 'color_palette' | 'font' | 'secret';

export interface VaultAsset {
  id: string;
  client_id: string;
  user_id: string;
  name: string;
  description: string | null;
  asset_type: AssetType;
  
  // File specific
  file_url: string | null;
  mime_type: string | null;
  
  // Secret specific
  encrypted_secret: string | null;
  
  // Metadata (for colors/fonts)
  metadata: any | null; 
  
  created_at: string;
  updated_at: string;
}

export interface ColorMetadata {
  hex: string;
  rgb?: string;
  cmyk?: string;
}

export interface FontMetadata {
  font_name: string;
  preview_text: string;
}

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  file: 'Arquivo/Documento',
  color_palette: 'Paleta de Cores',
  font: 'Tipografia',
  secret: 'Acesso/Senha',
};