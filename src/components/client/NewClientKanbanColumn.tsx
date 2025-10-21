"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import NewClientTaskCard from './NewClientTaskCard';
import { ClientTask } from '@/types/client';

interface NewClientKanbanColumnProps {
  title: string;
  tasks: ClientTask[];
  onAddTask: () => void;
}

const NewClientKanbanColumn: React.FC<NewClientKanbanColumnProps> = ({ title, tasks, onAddTask }) => {
  return (
    <div className="flex flex-col h-full rounded-md bg-secondary/30 p-2 w-full sm:w-64">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <Button variant="ghost" size="icon" onClick={onAddTask}>
          <PlusCircle className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-grow overflow-y-auto">
        {tasks.map(task => (
          <NewClientTaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
};

export default NewClientKanbanColumn;