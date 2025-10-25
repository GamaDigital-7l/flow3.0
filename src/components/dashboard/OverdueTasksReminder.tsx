// src/components/dashboard/OverdueTasksReminder.tsx
"use client";

import React, { useRef } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface OverdueTask {
  id: string;
  title: string;
  dueDate: string;
}

interface OverdueTasksReminderProps {
  tasks: OverdueTask[];
  onTaskUpdated: () => void; // Mantido para compatibilidade, mas não usado diretamente aqui
}

const OverdueTasksReminder: React.FC<OverdueTasksReminderProps> = ({ tasks }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  if (tasks.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300; // Scroll 300px
      scrollRef.current.scrollBy({
        left: direction === 'right' ? scrollAmount : -scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="py-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold flex items-center text-red-600">
          <AlertCircle className="h-5 w-5 mr-2" />
          Tarefas Atrasadas ({tasks.length})
        </h2>
        
        {/* Botões de Navegação (Apenas Desktop) */}
        {!isMobile && (
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => scroll('left')} className="h-8 w-8 text-muted-foreground hover:bg-accent">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => scroll('right')} className="h-8 w-8 text-muted-foreground hover:bg-accent">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      
      {/* Container de Scroll Isolado */}
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto space-x-4 pb-2 custom-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }} // Melhorar a rolagem em iOS
      >
        {tasks.map((task) => (
          <Card 
            key={task.id} 
            className="p-4 bg-red-50 border-red-300 flex-shrink-0 dark:bg-red-900/20 dark:border-red-700/50"
            style={{ width: '260px' }} // Largura fixa razoável
          >
            <p className="font-medium text-sm truncate text-foreground">{task.title}</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">Vencimento: {task.dueDate}</p>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default OverdueTasksReminder;