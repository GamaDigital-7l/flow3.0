"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useSession } from "@/integrations/supabase/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TaskOriginBoard } from "@/types/task";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import TaskForm from "../TaskForm";
import { DIALOG_CONTENT_CLASSNAMES } from "@/lib/constants";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { Client } from "@/types/client"; // Removido

interface QuickAddTaskInputProps {
  originBoard: TaskOriginBoard;
  onTaskAdded: () => void;
  dueDate?: Date;
}

// Removendo fetchClients, pois não precisamos mais de clientes aqui.

const QuickAddTaskInput: React.FC<QuickAddTaskInputProps> = ({ originBoard, onTaskAdded, dueDate }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleAddTask = async () => {
    if (input.trim() === "" || isLoading || !userId) return;

    setIsLoading(true);

    try {
      // --- Lógica para Tarefa Geral ---
      const { data: newTask, error: insertError } = await supabase.from("tasks").insert({
        user_id: userId,
        title: input,
        due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
        origin_board: originBoard,
        current_board: originBoard,
        is_priority: originBoard === "today_high_priority",
      }).select("id").single();

      if (insertError) throw insertError;
      showSuccess("Tarefa adicionada com sucesso!");

      setInput("");
      onTaskAdded();
    } catch (err: any) {
      showError("Erro ao adicionar tarefa: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        setIsFormOpen(true);
      } else {
        handleAddTask();
      }
    }
  };

  const handleTaskFormSaved = () => {
    onTaskAdded();
    setIsFormOpen(false);
    setInput("");
  };

  return (
    <>
      <div className="flex gap-2 w-full">
        <Input
          type="text"
          placeholder="Adicionar tarefa rápida (Shift+Enter para detalhes)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring h-9 text-sm"
          disabled={isLoading}
        />
        <Button 
          onClick={handleAddTask} 
          disabled={isLoading || input.trim() === ""} 
          className="w-10 h-9 p-0 bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0"
          size="icon"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
          <span className="sr-only">Adicionar</span>
        </Button>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={DIALOG_CONTENT_CLASSNAMES}>
          <DialogHeader>
            <DialogTitle className="text-foreground">Adicionar Nova Tarefa</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Crie uma nova tarefa com todos os detalhes.
            </DialogDescription>
          </DialogHeader>
          <TaskForm
            initialData={{
              title: input,
              due_date: dueDate, // dueDate é do tipo Date | undefined
              origin_board: originBoard,
              current_board: originBoard,
              is_priority: originBoard === "today_high_priority",
            } as any} // FIX TS2322
            onTaskSaved={handleTaskFormSaved}
            onClose={() => setIsFormOpen(false)}
            initialOriginBoard={originBoard}
            initialDueDate={dueDate}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuickAddTaskInput;