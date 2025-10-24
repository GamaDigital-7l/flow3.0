"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Eye, Users, CalendarDays } from "lucide-react";
import { PortfolioProject } from "@/types/portfolio";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface PortfolioCardProps {
  project: PortfolioProject;
  onEdit: (project: PortfolioProject) => void;
  onDelete: (projectId: string) => void;
}

const PortfolioCard: React.FC<PortfolioCardProps> = ({ project, onEdit, onDelete }) => {
  const projectYear = project.end_date ? format(new Date(project.end_date), 'yyyy') : 'N/A';

  return (
    <Card className="group relative overflow-hidden h-full bg-card border border-border rounded-xl shadow-sm transition-all duration-300 hover:shadow-xl card-hover-effect">
      <Link to={`/portfolio/${project.slug}`} className="block h-full">
        {/* Capa com Efeito de Hover */}
        <div className="relative w-full h-48 sm:h-64 overflow-hidden">
          <img
            src={project.main_cover_url || "/placeholder.svg"}
            alt={project.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {/* Overlay de Hover */}
          <div className={cn(
            "absolute inset-0 bg-black/40 flex items-end p-4 transition-opacity duration-300",
            "opacity-0 group-hover:opacity-100"
          )}>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white line-clamp-2">{project.title}</h3>
              <p className="text-sm text-primary font-medium">{project.category}</p>
            </div>
          </div>
        </div>
      </Link>

      {/* Ações de Gerenciamento (Visíveis no hover ou sempre no mobile) */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
        <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); onEdit(project); }} className="h-8 w-8 text-white bg-black/50 hover:bg-black/70">
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); onDelete(project.id); }} className="h-8 w-8 text-red-500 bg-black/50 hover:bg-black/70">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Informações na Base (Sempre visíveis) */}
      <CardContent className="p-3 flex justify-between items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{project.title}</p>
          <p className="text-xs text-muted-foreground">{project.category}</p>
        </div>
        <span className="text-sm font-bold text-primary flex-shrink-0">{projectYear}</span>
      </CardContent>
    </Card>
  );
};

export default PortfolioCard;