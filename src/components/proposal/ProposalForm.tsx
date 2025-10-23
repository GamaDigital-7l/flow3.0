import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Copy, Send, Users } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/integrations/supabase/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { showError, showSuccess } from '@/utils/toast';
import { Proposal, ProposalItem, PROPOSAL_TEMPLATES } from '@/types/proposal';
import ProposalItemForm from './ProposalItemForm';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// Tipos simplificados para evitar dependência de '@/types/client'
interface Client {
  id: string;
  name: string;
}

const itemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Nome do item é obrigatório."),
  description: z.string().nullable().optional(),
  quantity: z.number().min(0.01, "Quantidade deve ser positiva."),
  unit_price: z.number().min(0, "Preço unitário não pode ser negativo."),
});

const proposalSchema = z.object({
  title: z.string().min(1, "O título é obrigatório."),
  client_id: z.string().nullable().optional(),
  client_name: z.string().min(1, "O nome do cliente é obrigatório."),
  client_company: z.string().nullable().optional(),
  template_name: z.string().nullable().optional(),
  validity_days: z.number().int().min(1, "Validade deve ser de pelo menos 1 dia.").default(7),
  payment_conditions: z.string().nullable().optional(),
  custom_terms: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1, "A proposta deve ter pelo menos um item."),
});

export type ProposalFormValues = z.infer<typeof proposalSchema>;

interface ProposalFormProps {
  initialData?: Proposal;
  onProposalSaved: () => void;
  onClose: () => void;
}

const fetchClients = async (userId: string): Promise<Client[]> => {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
};

const ProposalForm: React.FC<ProposalFormProps> = ({ initialData, onProposalSaved, onClose }) => {
  const { session } = useSession();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  const isEditing = !!initialData;

  const { data: clients, isLoading: isLoadingClients } = useQuery({
    queryKey: ["clientsList", userId],
    queryFn: () => fetchClients(userId!),
    enabled: !!userId,
  });

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      title: initialData?.title || "",
      client_id: initialData?.client_id || null,
      client_name: initialData?.client_name || "",
      client_company: initialData?.client_company || null,
      template_name: initialData?.template_name || null,
      validity_days: initialData?.validity_days || 7,
      payment_conditions: initialData?.payment_conditions || "50% no início, 50% na entrega.",
      custom_terms: initialData?.custom_terms || "A proposta é válida por 7 dias. Após a aceitação, o cronograma será definido.",
      items: initialData?.items || [{ name: "Serviço Padrão", description: null, quantity: 1, unit_price: 0 }],
    },
  });

  const selectedClientId = form.watch('client_id');
  const selectedTemplate = form.watch('template_name');

  // Efeito para preencher nome do cliente ao selecionar ID
  useEffect(() => {
    if (selectedClientId && clients) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        form.setValue('client_name', client.name, { shouldDirty: true });
      }
    }
  }, [selectedClientId, clients, form]);

  // Efeito para aplicar template
  useEffect(() => {
    if (selectedTemplate && selectedTemplate !== 'Vazio') {
      const template = PROPOSAL_TEMPLATES.find(t => t.name === selectedTemplate);
      if (template) {
        form.setValue('title', template.title, { shouldDirty: true });
        form.setValue('items', template.items as ProposalItem[], { shouldDirty: true });
      }
    }
  }, [selectedTemplate, form]);


  const saveProposalMutation = useMutation({
    mutationFn: async (values: ProposalFormValues) => {
      if (!userId) throw new Error("Usuário não autenticado.");

      const proposalData = {
        user_id: userId,
        client_id: values.client_id || null,
        title: values.title,
        client_name: values.client_name,
        client_company: values.client_company || null,
        template_name: values.template_name || null,
        validity_days: values.validity_days,
        payment_conditions: values.payment_conditions || null,
        custom_terms: values.custom_terms || null,
        updated_at: new Date().toISOString(),
      };

      let proposalId: string;

      if (isEditing) {
        const { data, error } = await supabase
          .from("proposals")
          .update(proposalData)
          .eq("id", initialData.id)
          .eq("user_id", userId)
          .select("id")
          .single();

        if (error) throw error;
        proposalId = data.id;
        showSuccess("Proposta atualizada com sucesso!");
      } else {
        // Cria um unique_link_id na criação
        const uniqueLinkId = crypto.randomUUID().substring(0, 8);
        const { data, error } = await supabase.from("proposals").insert({
          ...proposalData,
          unique_link_id: uniqueLinkId,
          status: 'draft',
        }).select("id").single();

        if (error) throw error;
        proposalId = data.id;
        showSuccess("Proposta criada com sucesso!");
      }

      // Handle items (delete existing and insert new ones)
      await supabase.from("proposal_items").delete().eq("proposal_id", proposalId);

      const itemsToInsert = values.items.map((item, index) => ({
        proposal_id: proposalId,
        name: item.name,
        description: item.description || null,
        quantity: item.quantity,
        unit_price: item.unit_price,
        order_index: index,
      }));

      const { error: itemInsertError } = await supabase.from("proposal_items").insert(itemsToInsert);
      if (itemInsertError) throw itemInsertError;
      
      return proposalId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals", userId] });
      onProposalSaved();
    },
    onError: (error: any) => {
      showError("Erro ao salvar proposta: " + error.message);
      console.error("Erro ao salvar proposta:", error);
    },
  });

  const onSubmit = (values: ProposalFormValues) => {
    saveProposalMutation.mutate(values);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-4 bg-card rounded-xl card-hover-effect">
        
        {/* Título e Template */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Título da Proposta</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Proposta de Branding para [Cliente]" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="template_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Template (Opcional)</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || 'Vazio'}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar template" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PROPOSAL_TEMPLATES.map(template => (
                      <SelectItem key={template.name} value={template.name}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Cliente */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="client_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <Users className="h-4 w-4" /> Cliente (Opcional)
                </FormLabel>
                <Select
                  onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                  value={field.value || '__none__'}
                  disabled={isLoadingClients}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Vincular a um cliente existente" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="__none__">Nenhum Cliente</SelectItem>
                    {clients?.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="client_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do Contato</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do contato principal" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="client_company"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome da Empresa (Opcional)</FormLabel>
              <FormControl>
                <Input placeholder="Nome da empresa do cliente" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Itens do Orçamento */}
        <ProposalItemForm form={form as UseFormReturn<ProposalFormValues>} />

        {/* Condições e Termos */}
        <div className="space-y-4 border-t border-border pt-4">
          <h3 className="text-lg font-semibold text-foreground">Condições</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="validity_days"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Validade (dias)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="payment_conditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condições de Pagamento</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 50% / 50%" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="custom_terms"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações/Termos Personalizados (Opcional)</FormLabel>
                <FormControl>
                  <Textarea placeholder="Detalhes sobre o cronograma, escopo, etc." {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={saveProposalMutation.isPending}>
          {saveProposalMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {isEditing ? "Salvar Alterações" : "Criar Proposta (Rascunho)"}
        </Button>
      </form>
    </Form>
  );
};

export default ProposalForm;