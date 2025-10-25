// src/components/dashboard/OverdueTasksReminder.tsx
import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface OverdueTask {
  id: string;
  title: string;
  dueDate: string;
}

interface OverdueTasksReminderProps {
  tasks: OverdueTask[];
}

const OverdueTasksReminder: React.FC<OverdueTasksReminderProps> = ({ tasks }) => {
  if (tasks.length === 0) return null;

  return (
    <div className="py-4">
      <h2 className="text-lg font-semibold mb-3 flex items-center text-red-600">
        <AlertCircle className="h-5 w-5 mr-2" />
        Tarefas Atrasadas ({tasks.length})
      </h2>
      
      {/* Container de Scroll Isolado */}
      <div className="flex overflow-x-auto space-x-4 pb-2 custom-scrollbar">
        {tasks.map((task) => (
          <Card 
            key={task.id} 
            className="p-4 bg-red-50 border-red-300 flex-shrink-0"
            style={{ width: '260px' }} // Largura fixa razoável
          >
            <p className="font-medium text-sm truncate">{task.title}</p>
            <p className="text-xs text-red-600 mt-1">Vencimento: {task.dueDate}</p>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default OverdueTasksReminder;