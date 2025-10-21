"use client";

import React from 'react';
import NewClientKanbanColumn from '@/components/client/NewClientKanbanColumn';

const NewClientKanbanPage: React.FC = () => {
  const tasks = [
    { id: '1', title: 'Tarefa 1' },
    { id: '2', title: 'Tarefa 2' },
    { id: '3', title: 'Tarefa 3' },
  ];

  return (
    <div className="flex flex-col sm:flex-row gap-4 p-4">
      <NewClientKanbanColumn title="A Fazer" tasks={tasks} onAddTask={() => {}} />
      <NewClientKanbanColumn title="Em Andamento" tasks={tasks} onAddTask={() => {}} />
      <NewClientKanbanColumn title="Concluído" tasks={[]} onAddTask={() => {}} />
    </div>
  );
};

export default NewClientKanbanPage;