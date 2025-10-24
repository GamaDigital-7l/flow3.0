"use client";

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PortfolioProject } from "@/types/portfolio";
import { Loader2, ArrowLeft, Users, CalendarDays, Link as LinkIcon, Share2, MessageSquare, ExternalLink, Zap } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import copy from "copy-to-clipboard";
import { motion } from "framer-motion"; // Adicionando framer-motion para transições suaves

const fetchProjectBySlug = async (slug: string): Promise<PortfolioProject | null> => {
  const { data, error } = await supabase
    .from("portfolio_projects")
    .select(`
      *,
      client:clients(id, name)
    `)
    .eq("slug", slug)
    .eq("is_public", true) // Apenas projetos públicos
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data as PortfolioProject | null;
};

// Fetch 3 random projects excluding the current one
const fetchSuggestedProjects = async (userId: string, currentProjectId: string): Promise<PortfolioProject[]> => {
  const { data, error } = await supabase
    .from("portfolio_projects")
    .select(`id, title, slug, category, main_cover_url, end_date`)
    .eq("user_id", userId)
    .eq("is_public", true)
    .neq("id", currentProjectId)
    .limit(3); // Limitar a 3 sugestões

  if (error) {
    console.error("Error fetching suggested projects:", error);
    return [];
  }
  return data as PortfolioProject[] || [];
};

const PortfolioProjectPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const { data: project, isLoading, error } = useQuery<PortfolioProject | null, Error>({
    queryKey: ["portfolioProjectPublic", slug],
    queryFn: () => fetchProjectBySlug(slug!),
    enabled: !!slug,
  });
  
  const { data: suggestedProjects } = useQuery<PortfolioProject[], Error>({
    queryKey: ["suggestedProjects", project?.user_id, project?.id],
    queryFn: () => fetchSuggestedProjects(project!.user_id, project!.id),
    enabled: !!project?.user_id && !!project?.id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8 flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground">Projeto Não Encontrado</h1>
          <p className="text-lg text-muted-foreground">O projeto que você está procurando não existe ou não é público.</p>
          <Button onClick={() => navigate('/portfolio')} className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o Portfólio
          </Button>
        </div>
      </div>
    );
  }
  
  const projectUrl = `${window.location.origin}/portfolio/${project.slug}`;

  const handleCopyLink = () => {
    copy(projectUrl);
    showSuccess("Link do projeto copiado!");
  };

  const handleShareWhatsApp = () => {
    const message = `Confira este projeto incrível da Gama Flow: ${project.title}. Link: ${projectUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };
  
  const handleCTAClick = () => {
    const whatsappMessage = `Olá Gama Flow! Gostei muito do projeto "${project.title}" e gostaria de solicitar um orçamento.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`, '_blank');
  };

  // Componente para renderizar itens da galeria com animação
  const GalleryItem: React.FC<{ url: string; index: number }> = ({ url, index }) => {
    const isVideo = url.match(/\.(mp4|webm|ogg)$/i);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.1 }}
        transition={{ duration: 0.5, delay: index * 0.1 }}
        className="w-full rounded-lg overflow-hidden shadow-xl border border-border/50"
      >
        {isVideo ? (
          <video controls className="w-full h-auto">
            <source src={url} />
            Seu navegador não suporta o elemento de vídeo.
          </video>
        ) : (
          <img 
            src={url} 
            alt={`Galeria ${index + 1}`} 
            className="w-full h-auto object-cover transition-transform duration-500 hover:scale-[1.01] cursor-pointer" 
            // Implementação de Lightbox seria aqui
          />
        )}
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Capa Principal (Full Width) */}
      <div className="relative w-full h-64 sm:h-96 bg-secondary/50 overflow-hidden">
        <img
          src={project.main_cover_url || "/placeholder.svg"}
          alt={project.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/30 flex items-end p-6">
          <h1 className="text-4xl font-extrabold text-white drop-shadow-lg">{project.title}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-10">
        
        {/* Metadados e Ações */}
        <Card className="bg-card border border-border rounded-xl shadow-lg">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="bg-primary text-white">{project.category}</Badge>
              {project.client?.name && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Users className="h-4 w-4" /> Cliente: {project.client.name}
                </p>
              )}
              {project.end_date && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" /> Concluído em: {format(new Date(project.end_date), 'MMM yyyy', { locale: ptBR })}
                </p>
              )}
            </div>
            <div className="flex gap-3 border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <LinkIcon className="mr-2 h-4 w-4" /> Copiar Link
              </Button>
              <Button variant="outline" size="sm" onClick={handleShareWhatsApp}>
                <MessageSquare className="mr-2 h-4 w-4" /> WhatsApp
              </Button>
              {project.external_link && (
                <Button variant="outline" size="sm" asChild>
                    <a href={project.external_link} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" /> Behance/Externo
                    </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Descrição e Resultado */}
        <Card className="bg-card border border-border rounded-xl shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-foreground">O Projeto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.short_description && (
              <p className="text-lg text-foreground">{project.short_description}</p>
            )}
            {project.result_differentiator && (
              <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg flex items-start gap-3">
                <Zap className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
                <div>
                    <h3 className="font-semibold text-primary text-lg">Resultado/Diferencial:</h3>
                    <p className="text-sm text-foreground">{project.result_differentiator}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Galeria de Conteúdo */}
        {project.gallery_urls && project.gallery_urls.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-foreground">Galeria de Imagens</h2>
            <div className="grid grid-cols-1 gap-6">
              {project.gallery_urls.map((url, index) => (
                <GalleryItem key={index} url={url} index={index} />
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {project.tags && project.tags.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {project.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-muted-foreground hover:bg-accent cursor-pointer">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* CTA Final (WhatsApp) */}
        <Card className="bg-primary text-white rounded-xl shadow-lg text-center p-8">
          <CardTitle className="text-2xl font-bold mb-2">Gostou deste projeto?</CardTitle>
          <CardDescription className="text-primary-foreground/90 mb-4">
            Entre em contato agora mesmo para solicitar um orçamento personalizado.
          </CardDescription>
          <Button onClick={handleCTAClick} variant="secondary" className="bg-white text-primary hover:bg-gray-100 font-bold text-base">
            <MessageSquare className="mr-2 h-5 w-5" /> Falar com a Gama no WhatsApp
          </Button>
        </Card>
        
        {/* Bloco "Outros projetos" (Sugestões) */}
        {suggestedProjects && suggestedProjects.length > 0 && (
            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-foreground">Outros Projetos</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {suggestedProjects.map(sug => (
                        <Link key={sug.id} to={`/portfolio/${sug.slug}`} className="block group">
                            <Card className="bg-card border border-border shadow-sm transition-shadow duration-200 hover:shadow-md">
                                <div className="w-full h-24 overflow-hidden">
                                    <img src={sug.main_cover_url || "/placeholder.svg"} alt={sug.title} className="w-full h-full object-cover" />
                                </div>
                                <CardContent className="p-3">
                                    <p className="text-sm font-semibold text-foreground line-clamp-1">{sug.title}</p>
                                    <p className="text-xs text-muted-foreground">{sug.category}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default PortfolioProjectPage;