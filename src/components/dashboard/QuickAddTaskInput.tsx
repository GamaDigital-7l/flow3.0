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
import { Client } from "@/types/client";

interface QuickAddTaskInputProps {
  originBoard: TaskOriginBoard;
  onTaskAdded: () => void;
  dueDate?: Date;
}

const fetchClients = async (userId: string): Promise<Pick<Client, 'id' | 'name'>[]> => {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
};

const QuickAddTaskInput: React.FC<QuickAddTaskInputProps> = ({ originBoard, onTaskAdded, dueDate }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const { data: clients, isLoading: isLoadingClients } = useQuery({
    queryKey: ["clientsListForQuickAdd", userId],
    queryFn: () => fetchClients(userId!),
    enabled: !!userId,
  });

  const handleAddTask = async () => {
    if (input.trim() === "" || isLoading || !userId) return;

    setIsLoading(true);

    try {
      if (selectedClientId) {
        // --- Lógica para Tarefa de Cliente ---
        const monthYearRef = format(dueDate || new Date(), "yyyy-MM");
        const clientName = clients?.find(c => c.id === selectedClientId)?.name;

        // 1. Criar a tarefa principal no dashboard
        const { data: mainTask, error: mainTaskError } = await supabase.from("tasks").insert({
          user_id: userId,
          title: `[CLIENTE] ${input}`,
          due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
          origin_board: "client_tasks",
          current_board: "client_tasks",
          client_name: clientName || null,
        }).select("id").single();

        if (mainTaskError) throw mainTaskError;

        // 2. Criar a tarefa do cliente, vinculada à tarefa principal
        const { error: clientTaskError } = await supabase.from("client_tasks").insert({
          client_id: selectedClientId,
          user_id: userId,
          title: input,
          month_year_reference: monthYearRef,
          status: 'in_progress',
          due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
          is_standard_task: true,
          main_task_id: mainTask.id,
        });

        if (clientTaskError) throw clientTaskError;

        showSuccess(`Tarefa adicionada para o cliente ${clientName}!`);
        queryClient.invalidateQueries({ queryKey: ["clientTasks", selectedClientId, userId] });
        queryClient.invalidateQueries({ queryKey: ["dashboardTasks", "client_tasks", userId] });
      } else {
        // --- Lógica para Tarefa Geral (existente) ---
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
      }

      setInput("");
      setSelectedClientId(null);
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
      <div className="flex flex-col sm:flex-row gap-2">
        <Select onValueChange={(value) => setSelectedClientId(value === "general" ? null : value)} value={selectedClientId || "general"}>
          <SelectTrigger className="w-full sm:w-[150px] bg-input border-border text-foreground focus-visible:ring-ring flex-shrink-0">
            <SelectValue placeholder="Selecionar..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">Tarefa Geral</SelectItem>
            {clients?.map(client => (
              <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="text"
          placeholder="Adicionar tarefa rápida (Enter) ou abrir formulário (Shift+Enter)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-grow bg-input border-border text-foreground focus-visible:ring-ring"
          disabled={isLoading}
        />
        <Button onClick={handleAddTask} disabled={isLoading || input.trim() === ""} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
          <span className="sr-only sm:not-sr-only sm:ml-2">Adicionar</span>
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
            }}
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