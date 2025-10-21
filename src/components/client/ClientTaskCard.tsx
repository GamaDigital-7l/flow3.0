import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ClientTask, ClientTaskStatus } from "@/types/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, CalendarDays, CheckCircle2, Edit2, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { cn } from "@/lib/utils";
import FullScreenImageViewer from "./FullScreenImageViewer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatDateTime, formatTime } from "@/lib/utils"; // Importando as novas funções
import { AspectRatio } from "@/components/ui/aspect-ratio"; // Importando AspectRatio

interface ClientTaskCardProps {
  task: ClientTask;
  columnId: ClientTaskStatus;
  onEdit: (task: ClientTask) => void;
  onApprove: (taskId: string) => void;
  onRequestEdit: (task: ClientTask) => void;
}

const ClientTaskCard: React.FC<ClientTaskCardProps> = ({ task, columnId, onEdit, onApprove, onRequestEdit }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "ClientTask", task, columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
  };

  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

  const handleImageClick = (index: number) => {
    setViewerInitialIndex(index);
    setIsImageViewerOpen(true);
  };

  const isReviewColumn = columnId === 'under_review';
  const isApprovedColumn = columnId === 'approved';
  const isEditRequested = task.status === 'edit_requested';

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-card border border-border rounded-lg shadow-md p-3 cursor-grab transition-all duration-200",
        isDragging && "opacity-50 ring-2 ring-primary",
        isEditRequested && "border-orange-500 ring-1 ring-orange-500/50 bg-orange-500/10"
      )}
    >
      <CardHeader className="p-0 pb-2">
        <CardTitle className="text-sm font-semibold text-foreground break-words line-clamp-2">
          {task.title}
        </CardTitle>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
        )}
      </CardHeader>
      <CardContent className="p-0 space-y-2">
        {task.image_urls && task.image_urls.length > 0 && (
          <div className="relative w-full rounded-md overflow-hidden cursor-pointer" onClick={() => handleImageClick(0)}>
            <AspectRatio ratio={4 / 5} className="bg-muted">
              <img
                src={task.image_urls[0]}
                alt={task.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </AspectRatio>
            {task.image_urls.length > 1 && (
              <Badge className="absolute bottom-1 right-1 bg-black/70 text-white text-xs">+{task.image_urls.length - 1}</Badge>
            )}
          </div>
        )}
        {task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.map((tag) => (
              <Badge key={tag.id} style={{ backgroundColor: tag.color, color: '#FFFFFF' }} className="text-xs flex-shrink-0">
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
        {(task.due_date || task.time) && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <CalendarDays className="h-3 w-3 flex-shrink-0" />
            {task.due_date && formatDateTime(task.due_date, false)}
            {task.time && ` às ${formatTime(task.time)}`}
          </p>
        )}
        {isEditRequested && task.edit_reason && (
          <div className="p-2 bg-orange-500/20 rounded-md">
            <p className="text-xs font-semibold text-orange-600">Edição Solicitada:</p>
            <p className="text-xs text-orange-500 line-clamp-2">{task.edit_reason}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-0 pt-2 flex justify-between items-center">
        <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-7 w-7 text-blue-500 hover:bg-blue-500/10">
          <Edit className="h-4 w-4" />
          <span className="sr-only">Editar Tarefa</span>
        </Button>
        {(isReviewColumn || isApprovedColumn) && (
          <Button
            variant={isApprovedColumn ? "default" : "secondary"}
            size="sm"
            onClick={() => onApprove(task.id)}
            className={cn("h-7 px-2 text-xs", isApprovedColumn ? "bg-green-600 hover:bg-green-700 text-white" : "bg-green-500/20 text-green-500 hover:bg-green-500/30")}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" /> {isApprovedColumn ? "Postar" : "Aprovar"}
          </Button>
        )}
        {isReviewColumn && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRequestEdit(task)}
            className="h-7 px-2 text-xs border-orange-500 text-orange-500 hover:bg-orange-500/10"
          >
            <Edit2 className="h-3 w-3 mr-1" /> Editar
          </Button>
        )}
      </CardFooter>

      {task.image_urls && (
        <FullScreenImageViewer
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
          imageUrls={task.image_urls}
          initialIndex={viewerInitialIndex}
          description={task.description}
        />
      )}
    </Card>
  );
};

export default ClientTaskCard;