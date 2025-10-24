"use client";

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PortfolioProject } from '@/types/portfolio';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Image, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ProposalPortfolioGalleryProps {
  userId: string;
  proposalId: string; // Usado para buscar projetos relevantes
}

// Fetch projects marked as 'add_to_proposals' automatically, or manually selected projects (if implemented later).
// For now, we fetch up to 3 projects marked for automatic inclusion.
const fetchProposalProjects = async (userId: string): Promise<PortfolioProject[]> => {
  const { data, error } = await supabase
    .from("portfolio_projects")
    .select(`
      id, title, slug, category, main_cover_url, end_date
    `)
    .eq("user_id", userId)
    .eq("add_to_proposals", true)
    .order("end_date", { ascending: false, nullsFirst: false })
    .limit(3); // Limitar a 3 projetos para a galeria compacta

  if (error) throw error;
  return data as PortfolioProject[] || [];
};

const ProposalPortfolioGallery: React.FC<ProposalPortfolioGalleryProps> = ({ userId }) => {
  const { data: projects, isLoading, error } = useQuery<PortfolioProject[], Error>({
    queryKey: ["proposalPortfolioGallery", userId],
    queryFn: () => fetchProposalProjects(userId),
    enabled: !!userId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !projects || projects.length === 0) {
    return null; // Não renderiza se não houver projetos ou se houver erro
  }

  return (
    <Card className="bg-card border border-border rounded-xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground flex items-center gap-2">
          <Image className="h-5 w-5 text-primary" /> Nossos Cases de Sucesso
        </CardTitle>
        <CardContent className="p-0 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(project => (
              <Link key={project.id} to={`/portfolio/${project.slug}`} target="_blank" rel="noopener noreferrer" className="block">
                <div className="group relative overflow-hidden rounded-lg shadow-md transition-shadow duration-300 hover:shadow-xl">
                  <div className="w-full h-32 overflow-hidden">
                    <img
                      src={project.main_cover_url || "/placeholder.svg"}
                      alt={project.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  <div className="p-3 bg-muted/50 border-t border-border">
                    <p className="text-sm font-semibold text-foreground line-clamp-1">{project.title}</p>
                    <p className="text-xs text-muted-foreground">{project.category}</p>
                  </div>
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <ExternalLink className="h-6 w-6 text-white" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </CardHeader>
    </Card>
  );
};

export default ProposalPortfolioGallery;