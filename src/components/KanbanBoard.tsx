"use client";

import React, { useState, useMemo } from "react";
import { DndContext, DragEndEvent, closestCorners } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import { Client } from "@/types/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUpdateClientStatus, useDeleteClient } from "@/integrations/supabase/queries";
import { toast } from "sonner";
import { EmptyState } from "./EmptyState";
import { ClientCardActions } from "./ClientCardActions";
import { cn } from "@/lib/utils";

interface KanbanBoardProps {
  clients: Client[];
}

const KANBAN_COLUMNS = [
  { id: "Lead", title: "Lead (Novo)" },
  { id: "In Progress", title: "Em Progresso" },
  { id: "Completed", title: "Concluído" },
  { id: "Archived", title: "Arquivado" },
];

interface KanbanColumnProps {
  id: string;
  title: string;
  clients: Client[];
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ id, title, clients }) => {
  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      <h3 className="text-lg font-semibold mb-3 text-foreground">{title} ({clients.length})</h3>
      <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2">
        <SortableContext items={clients.map(c => c.id)} strategy={horizontalListSortingStrategy}>
          {clients.map((client) => (
            <Card key={client.id} className="bg-card border border-border shadow-md cursor-grab active:cursor-grabbing">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
                <CardTitle className="text-sm font-medium truncate">{client.name}</CardTitle>
                <ClientCardActions client={client} />
              </CardHeader>
              <CardContent className="p-3 pt-1">
                <p className="text-xs text-muted-foreground truncate">{client.email}</p>
                <p className={cn("text-xs font-semibold mt-1", client.status === 'Lead' ? 'text-blue-500' : 'text-green-500')}>
                  Status: {client.status}
                </p>
              </CardContent>
            </Card>
          ))}
        </SortableContext>
      </div>
    </div>
  );
};

export function KanbanBoard({ clients }: KanbanBoardProps) {
  const updateStatusMutation = useUpdateClientStatus();

  const clientsByStatus = useMemo(() => {
    const map = new Map<string, Client[]>();
    KANBAN_COLUMNS.forEach(col => map.set(col.id, []));
    clients.forEach(client => {
      const status = client.status || 'Lead'; // Fallback para 'Lead'
      if (map.has(status)) {
        map.get(status)?.push(client);
      } else {
        // Se o status não estiver mapeado, coloca em 'Lead'
        map.get('Lead')?.push(client);
      }
    });
    return map;
  }, [clients]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const clientId = active.id as string;
    const newStatus = over.id as string;

    const clientToUpdate = clients.find(c => c.id === clientId);

    if (clientToUpdate && clientToUpdate.status !== newStatus) {
      updateStatusMutation.mutate(
        { id: clientToUpdate.id, status: newStatus },
        {
          onSuccess: () => {
            toast.success(`Cliente ${clientToUpdate.name} movido para ${newStatus}!`);
          },
          onError: (error) => {
            toast.error("Erro ao mover cliente:", { description: error.message });
          },
        }
      );
    }
  };

  if (clients.length === 0) {
    return <EmptyState />;
  }

  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
      <div className="flex gap-6 overflow-x-auto h-full pb-4">
        {KANBAN_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            clients={clientsByStatus.get(column.id) || []}
          />
        ))}
      </div>
    </DndContext>
  );
}