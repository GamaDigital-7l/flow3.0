"use client";

import React from 'react';

interface NewClientTaskCardProps {
  task: any;
}

const NewClientTaskCard: React.FC<NewClientTaskCardProps> = ({ task }) => {
  return (
    <div className="bg-card border border-border rounded-md p-2 mb-2">
      <h4 className="text-sm font-medium text-foreground">{task.title}</h4>
      {/* Adicione mais detalhes da tarefa aqui */}
    </div>
  );
};

export default NewClientTaskCard;