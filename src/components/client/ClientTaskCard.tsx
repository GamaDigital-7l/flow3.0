import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { ClientTask } from '@/types/client';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Clock, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientTaskCardProps {
  task: ClientTask;
  index: number;
  onClick: () => void;
}

const ClientTaskCard: React.FC<ClientTaskCardProps> = ({ task, index, onClick }) => {
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), "dd MMM", { locale: ptBR });
    } catch {
      return null;
    }
  };

  const coverImage = task.image_urls && task.image_urls.length > 0 ? task.image_urls[0] : null;

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-2"
          onClick={onClick}
        >
          <Card className={`hover:shadow-md transition-shadow duration-200 ${snapshot.isDragging ? 'bg-muted' : 'bg-card'}`}>
            {coverImage && (
              <img
                src={coverImage}
                alt={task.title}
                className="w-full h-32 object-cover rounded-t-lg"
              />
            )}
            <CardContent className="p-3">
              <p className="font-semibold text-sm mb-2">{task.title}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  {task.due_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(task.due_date)}
                    </span>
                  )}
                  {task.time && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {task.time}
                    </span>
                  )}
                </div>
                {task.image_urls && task.image_urls.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {task.image_urls.length}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
};

export default ClientTaskCard;