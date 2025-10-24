export interface PortfolioProject {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  category: string;
  client_id: string | null;
  
  short_description: string | null;
  result_differentiator: string | null;
  
  main_cover_url: string | null;
  gallery_urls: string[] | null;
  
  tags: string[] | null;
  external_link: string | null;
  
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null; // YYYY-MM-DD
  
  is_public: boolean;
  add_to_proposals: boolean;
  
  created_at: string;
  updated_at: string;

  // Relações
  client?: { id: string; name: string } | null;
}

export const PORTFOLIO_CATEGORIES = [
  "Social Media",
  "Landing Page",
  "Website",
  "Identidade Visual",
  "Campanha",
  "Outros",
];