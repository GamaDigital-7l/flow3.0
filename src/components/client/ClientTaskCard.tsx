"use client";

import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientTask, ClientTaskStatus } from "@/types/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, CalendarDays, CheckCircle2, Edit2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import FullScreenImageViewer from "./FullScreenImageViewer";

interface ClientTaskCardProps {
  task: ClientTask;
  columnId: ClientTaskStatus;
  onEdit: (task: ClientTask) => void;
  onApprove: (taskId: string) => void;
  onRequestEdit: (task: ClientTask) => void;
}

const ClientTaskCard: React.FC<ClientTaskCardProps> = ({ task, columnId, onEdit, onApprove, onRequestEdit }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 250ms ease', // Animação suave
    zIndex: isDragging ? 10 : undefined,
  };

  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  const handleImageClick = () => {
    if (task.image_urls && task.image_urls.length > 0) {
      setIsImageViewerOpen(true);
    }
  };

  return (
    <>
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={() => onEdit(task)}
        className={cn(
          "bg-card border border-border rounded-lg shadow-sm cursor-grab active:cursor-grabbing touch-none flex flex-col",
          isDragging && "shadow-xl opacity-80 scale-105"
        )}
      >
        {task.image_urls && task.image_urls.length > 0 && (
          <div className="aspect-[4/5] w-full overflow-hidden rounded-t-lg cursor-pointer" onClick={(e) => { e.stopPropagation(); handleImageClick(); }}>
            <img
              src={task.image_urls[0]}
              alt={task.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}
        <CardHeader className="p-3 pb-2">
          <CardTitle className="text-sm font-semibold text-foreground break-words line-clamp-2">
            {task.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 flex-grow">
          {task.description && (
            <p className="text-xs text-muted-foreground break-words line-clamp-3 mb-2">
              {task.description}
            </p>
          )}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.tags.map((tag) => (
                <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
          {task.due_date && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {format(new Date(task.due_date), "dd/MM", { locale: ptBR })}
            </span>
          )}
        </CardContent>
        <CardFooter className="p-2 border-t border-border flex justify-end gap-1">
          {columnId === 'under_review' && (
            <>
              <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onApprove(task.id); }} className="h-7 w-7 text-green-500 hover:bg-green-500/10">
                <CheckCircle2 className="h-4 w-4" />
                <span className="sr-only">Aprovar</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRequestEdit(task); }} className="h-7 w-7 text-orange-500 hover:bg-orange-500/10">
                <Edit2 className="h-4 w-4" />
                <span className="sr-only">Solicitar Edição</span>
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(task); }} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
            <Edit className="h-4 w-4" />
            <span className="sr-only">Revisar/Editar Tarefa</span>
          </Button>
        </CardFooter>
      </Card>
      <FullScreenImageViewer
        isOpen={isImageViewerOpen}
        onClose={() => setIsImageViewerOpen(false)}
        imageUrls={task.image_urls || []}
        initialIndex={0}
        description={task.description}
      />
    </>
  );
};

export default ClientTaskCard;