"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ClientTask, ClientTaskStatus } from "@/types/client";
import ClientTaskCard from "./ClientTaskCard";
import { cn } from "@/lib/utils";

interface ClientKanbanColumnProps {
  id: ClientTaskStatus;
  title: string;
  tasks: ClientTask[];
  onEditTask: (task: ClientTask) => void;
  onApproveTask: (taskId: string) => void;
  onRequestEditTask: (task: ClientTask) => void;
}

const ClientKanbanColumn: React.FC<ClientKanbanColumnProps> = ({ id, title, tasks, onEditTask, onApproveTask, onRequestEditTask }) => {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      // Ajustado para ser mais estreito em telas pequenas (w-64) e fixo em telas maiores (w-72)
      className={cn(
        "w-64 sm:w-72 flex-shrink-0 bg-card border border-border rounded-xl p-2 transition-colors duration-200 shadow-lg",
        isOver && "bg-primary/10"
      )}
    >
      <h3 className="font-semibold text-foreground px-2 mb-3">{title} ({tasks.length})</h3>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3 h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar pr-1">
          {tasks.map((task) => (
            <ClientTaskCard 
              key={task.id} 
              task={task} 
              columnId={id}
              onEdit={onEditTask}
              onApprove={onApproveTask}
              onRequestEdit={onRequestEditTask}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
};

export default ClientKanbanColumn;