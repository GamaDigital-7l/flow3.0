import React from "react";
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

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.image_urls && task.image_urls.length > 0) {
      setIsImageViewerOpen(true);
    }
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
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
          "bg-card border border-border rounded-lg shadow-sm cursor-grab active:cursor-grabbing flex flex-col w-full",
          isDragging && "shadow-xl opacity-80 scale-105"
        )}
      >
        {task.image_urls && task.image_urls.length > 0 && (
          <div className="aspect-[4/5] w-full overflow-hidden rounded-t-lg cursor-pointer" onClick={handleImageClick}>
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
              {format(new Date(task.due_date), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}
        </CardContent>
        <CardFooter className="p-2 border-t border-border flex justify-between items-center">
          <div className="flex gap-1">
            {columnId === 'under_review' && (
              <>
                <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, () => onApprove(task.id))} className="h-7 w-7 text-green-500 hover:bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="sr-only">Aprovar</span>
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => handleActionClick(e, () => onRequestEdit(task))} className="h-7 w-7 text-orange-500 hover:bg-orange-500/10">
                  <Edit2 className="h-4 w-4" />
                  <span className="sr-only">Solicitar Edição</span>
                </Button>
              </>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:bg-accent hover:text-foreground">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Mais Ações</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border rounded-md shadow-lg text-sm">
              <DropdownMenuItem onClick={(e) => handleActionClick(e, () => onEdit(task))} className="cursor-pointer py-1.5 px-2">
                <Edit className="mr-2 h-4 w-4" /> Revisar/Editar Tarefa
              </DropdownMenuItem>
              {/* Adicionar outras ações se necessário, como mover para posted */}
              {columnId === 'approved' && (
                <DropdownMenuItem onClick={(e) => handleActionClick(e, () => onApprove(task.id))} className="cursor-pointer py-1.5 px-2 text-green-500">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Marcar como Postado
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
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