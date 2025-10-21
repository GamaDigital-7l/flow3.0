import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "./client";
import { Client } from "@/types/client";

// Tipagem para um novo cliente (sem id, created_at, e com user_id opcional)
type NewClient = Omit<Client, 'id' | 'created_at' | 'user_id'>;

// --- Hooks de Cliente ---

// Hook para buscar clientes (RLS garante que apenas os do usuário logado sejam retornados)
export const useClients = () => {
  return useQuery<Client[], Error>({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*");
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
};

// Hook (Mutation) para adicionar um novo cliente
export const useAddClient = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (newClient: NewClient) => {
      // Pega a sessão atual para obter o ID do usuário
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("clients")
        .insert([{ ...newClient, user_id: session.user.id }])
        .select();

      if (error) throw new Error(error.message);
      return data[0];
    },
    onSuccess: () => {
      // Invalida a query de 'clients' para forçar um refetch e atualizar a UI
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
};


// Hook (Mutation) para atualizar o status de um cliente
export const useUpdateClientStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const { data, error } = await supabase
        .from("clients")
        .update({ status })
        .eq("id", id)
        .select();

      if (error) throw new Error(error.message);
      return data[0];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
};