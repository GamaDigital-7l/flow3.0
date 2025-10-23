"use client";

import React from "react";
import { Task } from "@/types/task";
import TaskItem from "@/components/TaskItem";
import RecurringTemplateHistory from "./RecurringTemplateHistory";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RecurringTemplateItemProps {
  templateTask: Task;
  refetchTemplates: () => void;
}

const RecurringTemplateItem: React.FC<RecurringTemplateItemProps> = ({ templateTask, refetchTemplates }) => {
  return (
    <Card className={cn(
      "p-0 border border-border rounded-xl bg-card shadow-sm transition-all duration-200 frosted-glass card-hover-effect"
    )}>
      {/* O TaskItem agora exibe o template (com a badge 'Template') e permite edição/deleção */}
      <div className="p-2">
        <TaskItem 
          task={templateTask} 
          refetchTasks={refetchTemplates} 
        />
      </div>
      
      {/* Histórico de Conclusão */}
      <CardContent className="p-3 pt-0 border-t border-border/50">
        <RecurringTemplateHistory templateId={templateTask.id} />
      </CardContent>
    </Card>
  );
};

export default RecurringTemplateItem;