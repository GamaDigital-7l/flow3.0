import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/integrations/supabase/auth";
import { PortfolioProject, PORTFOLIO_CATEGORIES } from "@/types/portfolio";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, FileText, Filter, Search, Image } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import PortfolioForm from "@/components/portfolio/PortfolioForm";
import PortfolioCard from "@/components/portfolio/PortfolioCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog"

const fetchPortfolioProjects = async (userId: string): Promise<PortfolioProject[]> => {
  const { data, error } = await supabase
    .from("portfolio_projects")
    .select(`
      *,
      client:clients(id, name)
    `)
    .eq("user_id", userId)
    .order("end_date", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data as PortfolioProject[] || [];
};

const Portfolio: React.FC = () => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<PortfolioProject | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [projectToDelete, setProjectToDelete] = useState<PortfolioProject | null>(null);

  const { data: projects, isLoading, error, refetch } = useQuery<PortfolioProject[], Error>({
    queryKey: ["portfolioProjects", userId],
    queryFn: () => fetchPortfolioProjects(userId!),
    enabled: !!userId,
  });

  const handleProjectSaved = () => {
    refetch();
    setIsFormOpen(false);
    setEditingProject(undefined);
  };

  const handleEditProject = (project: PortfolioProject) => {
    setEditingProject(project);
    setIsFormOpen(true);
  };

  const handleDeleteProject = useMutation({
    mutationFn: async (projectId: string) => {
      if (!userId) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("portfolio_projects")
        .delete()
        .eq("id", projectId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess("Projeto deletado com sucesso!");
      refetch();
      setProjectToDelete(null);
    },
    onError: (err: any) => {
      showError("Erro ao deletar projeto: " + err.message);
    },
  });

  const filteredProjects = projects?.filter(project => {
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          project.short_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          project.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || project.category === selectedCategory;

    return matchesSearch && matchesCategory;
  }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-primary">
        <Loader2 className="h-8 w-8 animate-spin mr-2" /> Carregando portfólio...
      </div>
    );
  }

  if (error) {
    showError("Erro ao carregar portfólio: " + error.message);
    return <p className="text-red-500">Erro ao carregar portfólio.</p>;
  }

  return (
    <div className="page-content-wrapper space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between flex-wrap gap-2 mb-6">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Image className="h-7 w-7 text-primary" /> Portfólio
        </h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingProject(undefined)} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
              <PlusCircle className="mr-2 h-4 w-4" /> Novo Projeto
            </Button>
          </DialogTrigger>
          <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingProject ? "Editar Projeto" : "Adicionar Novo Projeto"}</DialogTitle>
              <DialogDescription>
                {editingProject ? "Atualize os detalhes do projeto." : "Crie um novo case de sucesso para o seu portfólio."}
              </DialogDescription>
            </DialogHeader>
            <PortfolioForm
              initialData={editingProject}
              onProjectSaved={handleProjectSaved}
              onClose={() => setIsFormOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
      <p className="text-lg text-muted-foreground">
        Exiba seus melhores trabalhos em um formato profissional e compartilhável.
      </p>

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar por título, descrição ou tag..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-input border-border text-foreground focus-visible:ring-ring"
          />
        </div>
        <Select onValueChange={setSelectedCategory} defaultValue="all">
          <SelectTrigger className="w-full sm:w-auto">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filtrar por Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            {PORTFOLIO_CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid de Projetos (Behance Style Grid) */}
      {filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map(project => (
            <PortfolioCard
              key={project.id}
              project={project}
              onEdit={handleEditProject}
              onDelete={(id) => {
                const proj = projects?.find(p => p.id === id);
                if (proj) setProjectToDelete(proj);
              }}
            />
          ))}
        </div>
      ) : (
        <Card className="bg-card border-dashed border-border shadow-sm p-8 text-center">
          <CardTitle className="text-xl font-semibold text-muted-foreground">Nenhum projeto encontrado.</CardTitle>
          <CardDescription className="mt-2">Comece adicionando seu primeiro projeto de portfólio.</CardDescription>
        </Card>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <AlertDialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja deletar?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá deletar o projeto "{projectToDelete?.title}" permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDeleteProject.mutate(projectToDelete!.id)} className="bg-red-600 hover:bg-red-700">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para Edição */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">{editingProject ? "Editar Projeto" : "Adicionar Novo Projeto"}</DialogTitle>
            <DialogDescription>
              {editingProject ? "Atualize os detalhes do projeto." : "Crie um novo case de sucesso para o seu portfólio."}
            </DialogDescription>
          </DialogHeader>
          <PortfolioForm
            initialData={editingProject}
            onProjectSaved={handleProjectSaved}
            onClose={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Portfolio;