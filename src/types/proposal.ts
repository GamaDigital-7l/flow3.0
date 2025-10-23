export type ProposalStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired' | 'rejected';

export interface ProposalItem {
  id: string;
  proposal_id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  order_index: number;
  created_at: string;
}

export interface Proposal {
  id: string;
  user_id: string;
  client_id: string | null;
  
  title: string;
  client_name: string;
  client_company: string | null;
  template_name: string | null;
  validity_days: number;
  payment_conditions: string | null;
  custom_terms: string | null;
  
  status: ProposalStatus;
  unique_link_id: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  
  created_at: string;
  updated_at: string;
  
  items?: ProposalItem[];
  client?: { id: string; name: string } | null;
}

export interface ProposalHistoryEntry {
  id: string;
  proposal_id: string;
  user_id: string | null; // Null if action is anonymous (viewed/accepted via public link)
  event_type: 'created' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired' | 'updated';
  details: any; // JSONB for extra context
  created_at: string;
}

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  'draft': 'Rascunho',
  'sent': 'Enviado',
  'viewed': 'Visualizado',
  'accepted': 'Aceito',
  'expired': 'Expirado',
  'rejected': 'Rejeitado',
};

export const PROPOSAL_TEMPLATES = [
  { name: 'Vazio', title: 'Nova Proposta', items: [] },
  { name: 'Social Media', title: 'Proposta de Gestão de Mídias Sociais', items: [
    { name: 'Planejamento Estratégico', description: 'Análise de mercado e público-alvo.', quantity: 1, unit_price: 500 },
    { name: 'Criação de Conteúdo (15 posts)', description: 'Design e copy para 15 publicações.', quantity: 1, unit_price: 1500 },
    { name: 'Relatório Mensal', description: 'Análise de métricas e resultados.', quantity: 1, unit_price: 300 },
  ]},
  { name: 'Landing Page', title: 'Proposta de Desenvolvimento de Landing Page', items: [
    { name: 'Design e Wireframe', description: 'Criação do layout focado em conversão.', quantity: 1, unit_price: 800 },
    { name: 'Desenvolvimento Front-end', description: 'Implementação responsiva em HTML/CSS/JS.', quantity: 1, unit_price: 1200 },
    { name: 'Integração de Formulário', description: 'Conexão com ferramenta de email marketing.', quantity: 1, unit_price: 300 },
  ]},
];