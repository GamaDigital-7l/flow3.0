import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Task, TaskOriginBoard } from '@/types/task';
import TaskItem from '../TaskItem';
import { Loader2, AlertCircle } from 'lucide-react';
import QuickAddTaskInput from './QuickAddTaskInput';
import { cn } from '@/lib/utils';

interface TaskListBoardProps {
  title: string;
  tasks: Task[];
  isLoading: boolean;
  error: Error | null;
  refetchTasks: () => void;
  quickAddTaskInput: React.ReactNode;
  originBoard: TaskOriginBoard;
}

const TaskListBoard: React.FC<TaskListBoardProps> = ({
  title,
  tasks,
  isLoading,
  error,
  refetchTasks,
  quickAddTaskInput,
  originBoard,
}) => {
  return (
    <Card className="bg-card border-border shadow-lg card-hover-effect flex flex-col min-w-0">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xl font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3 flex-grow flex flex-col">
        {quickAddTaskInput}
        
        <div className="space-y-3 mt-3 flex-grow min-h-[100px]">
          {isLoading && (
            <div className="flex items-center justify-center p-4 text-primary">
              <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando...
            </div>
          )}
          
          {error && (
            <div className="flex items-center p-4 text-red-500 bg-red-500/10 rounded-lg">
              <AlertCircle className="h-5 w-5 mr-2" /> Erro ao carregar tarefas.
            </div>
          )}

          {!isLoading && !error && tasks.length === 0 && (
            <p className="text-muted-foreground p-4 text-center">Nenhuma tarefa nesta lista.</p>
          )}

          {!isLoading && tasks.map(task => (
            <TaskItem 
              key={task.id} 
              task={task} 
              refetchTasks={refetchTasks} 
              // Passando a origem para garantir que o TaskItem saiba onde está
              originBoard={originBoard} 
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TaskListBoard;