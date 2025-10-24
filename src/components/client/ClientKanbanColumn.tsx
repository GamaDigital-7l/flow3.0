"use client";

import React from 'react';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { PlusCircle } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from '@/lib/utils';
import ClientTaskCard from './ClientTaskCard';

// Tipos simplificados
type ClientTaskStatus = "in_progress" | "under_review" | "approved" | "edit_requested" | "posted";
interface ClientTask {
  id: string;
  title: string;
  description: string | null;
  status: ClientTaskStatus;
  due_date: string | null;
  time: string | null;
  image_urls: string[] | null;
  public_approval_enabled: boolean;
  edit_reason: string | null;
  client_id: string;
  user_id: string;
  is_completed: boolean;
  order_index: number;
  public_approval_link_id: string | null;
  tags: { id: string; name: string; color: string }[];
  month_year_reference: string | null;
}

interface KanbanColumnProps {
  column: { id: ClientTaskStatus; title: string; color: string };
  tasks: ClientTask[];
  onAddTask: (status: ClientTaskStatus) => void;
  onEditTask: (task: ClientTask) => void;
  refetchTasks: () => void;
  onImageClick: (url: string) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = React.memo(({
  column,
  tasks,
  onAddTask,
  onEditTask,
  refetchTasks,
  onImageClick,
}) => {
  const taskIds = React.useMemo(() => tasks.map(t => t.id), [tasks]);

  return (
    <Card 
      key={column.id} 
      className="w-80 flex-shrink-0 bg-secondary/50 border-border shadow-lg flex flex-col h-full max-h-full"
    >
      <CardHeader className="p-3 pb-2 flex-shrink-0">
        <CardTitle className={cn("text-lg font-semibold", column.color)}>{column.title} ({tasks.length})</CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onAddTask(column.id)} 
          className="w-full border-dashed border-border text-primary hover:bg-primary/10 h-8 text-sm mt-2"
        >
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Tarefa
        </Button>
      </CardHeader>
      
      <ScrollArea className="flex-1 p-3 pt-0">
        <CardContent className="space-y-3 min-h-[100px]">
          <SortableContext 
            items={taskIds} 
            strategy={verticalListSortingStrategy}
            id={column.id}
          >
            {tasks.map(task => (
              <ClientTaskCard 
                key={task.id} 
                task={task} 
                onEdit={onEditTask} 
                refetchTasks={refetchTasks}
                onImageClick={onImageClick}
              />
            ))}
          </SortableContext>
          
          {tasks.length === 0 && (
            <p className="text-muted-foreground text-sm text-center p-4">Arraste tarefas para cá ou crie uma nova.</p>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
});

export default KanbanColumn;