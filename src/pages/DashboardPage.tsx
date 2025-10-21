"use client";

import { KanbanBoard } from "@/components/KanbanBoard";
import { ThemeToggle } from "@/components/theme-toggle";
import { useClients } from "@/integrations/supabase/queries";
import { AddClientDialog } from "@/components/AddClientDialog";

const DashboardPage = () => {
  const { data: clients, isLoading, error } = useClients();

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">Meu Kanban de Clientes</h1>
        <div className="flex items-center gap-4">
          <AddClientDialog />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        {isLoading && <p>Carregando clientes...</p>}
        {error && <p className="text-red-500">Erro ao carregar clientes: {error.message}</p>}
        {clients && <KanbanBoard clients={clients} />}
      </main>
    </div>
  );
};

export default DashboardPage;